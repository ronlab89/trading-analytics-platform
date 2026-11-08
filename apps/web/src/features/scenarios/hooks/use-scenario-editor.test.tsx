import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useScenarioEditor } from "./use-scenario-editor";

const PAUSE = 40;
const usd = (amount: string) => ({ amount, currency: "USD" });

const scenario = (
  changes: { assetId: string; percentChange: number }[] = [],
  status = "DRAFT",
) => ({
  id: "s1",
  portfolioId: "p1",
  name: "Apple falls",
  description: null,
  baseSnapshotId: null,
  status,
  changes,
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

const position = (assetId: string, price: string) => ({
  id: `pos-${assetId}`,
  portfolioId: "p1",
  assetId,
  quantity: 10,
  averageEntryPrice: usd("100.00"),
  currentPrice: usd(price),
  openedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
});

const metrics = (total: string) => ({
  totalValue: usd(total),
  investedValue: usd("900.00"),
  unrealizedPnL: usd("0.00"),
  unrealizedPnLPercent: 0,
});

const calculation = {
  scenarioId: "s1",
  baseline: metrics("1000.00"),
  result: metrics("900.00"),
  difference: { totalValue: usd("-100.00"), unrealizedPnL: usd("-100.00") },
  unmatchedAssetIds: [],
};

type Answers = Partial<Record<string, (input?: CallInput) => Promise<unknown>>>;

function clientAnswering(answers: Answers = {}) {
  const base: Answers = {
    getScenario: () => Promise.resolve({ data: scenario() }),
    listPositions: () =>
      Promise.resolve({ data: [position("a1", "180.70"), position("a2", "410.20")] }),
    getAsset: (input) =>
      Promise.resolve({
        data: {
          id: input?.params?.assetId,
          symbol: input?.params?.assetId === "a1" ? "AAPL" : "MSFT",
        },
      }),
    calculateScenario: () => Promise.resolve({ data: calculation }),
    updateScenario: (input) =>
      Promise.resolve({
        data: scenario(
          (input?.body as { changes: { assetId: string; percentChange: number }[] }).changes,
        ),
      }),
    ...answers,
  };
  const call = vi.fn((operation: { operationId: string }, input?: CallInput) => {
    const answer = base[operation.operationId];
    return answer === undefined
      ? Promise.reject(new Error(`unexpected ${operation.operationId}`))
      : answer(input);
  });
  const updates = () =>
    call.mock.calls
      .filter(([operation]) => operation.operationId === "updateScenario")
      .map(([, input]) => input?.body);
  const calculations = () =>
    call.mock.calls.filter(([operation]) => operation.operationId === "calculateScenario").length;
  return { client: { call } as unknown as TradingClient, call, updates, calculations };
}

function setup(client: TradingClient) {
  return renderHook(() => useScenarioEditor("p1", "s1", { pauseMs: PAUSE }), {
    wrapper: tradingClientWrapper(client),
  });
}

async function ready(client: TradingClient) {
  const view = setup(client);
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false);
  });
  return view;
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

describe("useScenarioEditor", () => {
  it("is pending until the scenario, the positions and their assets are in, then has a slider per position", async () => {
    const { client } = clientAnswering({
      getScenario: () =>
        Promise.resolve({ data: scenario([{ assetId: "a2", percentChange: -5 }]) }),
    });
    const { result } = setup(client);

    expect(result.current.isPending).toBe(true);
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.variables.map(({ symbol, percent }) => [symbol, percent])).toEqual([
      ["AAPL", 0],
      ["MSFT", -5],
    ]);
    expect(result.current.scenario?.name).toBe("Apple falls");
  });

  it("is an error when the scenario cannot be read", async () => {
    const { client } = clientAnswering({ getScenario: () => Promise.reject(new Error("gone")) });
    const { result } = setup(client);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("moves the slider at once, but saves only after the pause and with the whole list of changes", async () => {
    const { client, updates } = clientAnswering();
    const { result } = await ready(client);

    act(() => {
      result.current.setPercent("a1", -10);
    });

    expect(result.current.variables[0]?.percent).toBe(-10);
    expect(result.current.saving).toBe(true);
    expect(updates()).toHaveLength(0);

    await waitFor(() => {
      expect(updates()).toEqual([{ changes: [{ assetId: "a1", percentChange: -10 }] }]);
    });
  });

  it("saves once with the last value when the slider keeps moving during the pause", async () => {
    const { client, updates } = clientAnswering();
    const { result } = await ready(client);

    act(() => {
      result.current.setPercent("a1", -3);
    });
    act(() => {
      result.current.setPercent("a1", -7);
    });
    act(() => {
      result.current.setPercent("a2", 5);
    });

    await waitFor(() => {
      expect(updates()).toHaveLength(1);
    });
    expect(updates()[0]).toEqual({
      changes: [
        { assetId: "a1", percentChange: -7 },
        { assetId: "a2", percentChange: 5 },
      ],
    });
  });

  it("sends no change for a slider put back on Base", async () => {
    const { client, updates } = clientAnswering({
      getScenario: () =>
        Promise.resolve({ data: scenario([{ assetId: "a1", percentChange: -10 }]) }),
    });
    const { result } = await ready(client);

    act(() => {
      result.current.setPercent("a1", 0);
    });

    await waitFor(() => {
      expect(updates()).toEqual([{ changes: [] }]);
    });
  });

  it("asks for the calculation again once the changes are saved, and is quiet when it is back", async () => {
    const { client, calculations } = clientAnswering();
    const { result } = await ready(client);
    await waitFor(() => {
      expect(calculations()).toBe(1);
    });

    act(() => {
      result.current.setPercent("a1", -10);
    });

    await waitFor(() => {
      expect(calculations()).toBe(2);
    });
    await waitFor(() => {
      expect(result.current.recalculating).toBe(false);
    });
    expect(result.current.saving).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it("says it is recalculating from the move until the new calculation is back", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    let calls = 0;
    const { client } = clientAnswering({
      calculateScenario: () => {
        calls += 1;
        return calls === 1
          ? Promise.resolve({ data: calculation })
          : new Promise((done) => {
              resolve = done;
            });
      },
    });
    const { result } = await ready(client);
    await waitFor(() => {
      expect(result.current.impact.data).toBeDefined();
    });
    expect(result.current.recalculating).toBe(false);

    act(() => {
      result.current.setPercent("a1", -10);
    });
    expect(result.current.recalculating).toBe(true);
    await waitFor(() => {
      expect(calls).toBe(2);
    });
    expect(result.current.recalculating).toBe(true);
    expect(result.current.impact.data).toEqual(calculation);

    await act(async () => {
      resolve({ data: calculation });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.recalculating).toBe(false);
    });
  });

  it("keeps what the user set when the save fails, and saves again on retry", async () => {
    let fail = true;
    const { client, updates } = clientAnswering({
      updateScenario: (input) =>
        fail
          ? Promise.reject(new Error("down"))
          : Promise.resolve({
              data: scenario(
                (input?.body as { changes: { assetId: string; percentChange: number }[] }).changes,
              ),
            }),
    });
    const { result } = await ready(client);

    act(() => {
      result.current.setPercent("a1", -10);
    });
    await waitFor(() => {
      expect(result.current.saveFailed).toBe(true);
    });
    expect(result.current.failed).toBe(true);
    expect(result.current.variables[0]?.percent).toBe(-10);

    fail = false;
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.saveFailed).toBe(false);
    });
    expect(updates()).toHaveLength(2);
    expect(result.current.variables[0]?.percent).toBe(-10);
  });

  it("is failed when the calculation fails, and retries it", async () => {
    let fail = true;
    const { client, calculations } = clientAnswering({
      calculateScenario: () =>
        fail ? Promise.reject(new Error("down")) : Promise.resolve({ data: calculation }),
    });
    const { result } = await ready(client);

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.saveFailed).toBe(false);

    fail = false;
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.failed).toBe(false);
    });
    expect(calculations()).toBeGreaterThanOrEqual(2);
  });

  it("does not send a second save while one is in flight, and sends the last value when it ends", async () => {
    const releases: (() => void)[] = [];
    const { client, updates } = clientAnswering({
      updateScenario: (input) =>
        new Promise((done) => {
          releases.push(() => {
            done({
              data: scenario(
                (input?.body as { changes: { assetId: string; percentChange: number }[] }).changes,
              ),
            });
          });
        }),
    });
    const { result } = await ready(client);

    act(() => {
      result.current.setPercent("a1", -10);
    });
    await waitFor(() => {
      expect(updates()).toHaveLength(1);
    });

    act(() => {
      result.current.setPercent("a1", -4);
    });
    await wait(PAUSE * 2);
    expect(updates()).toHaveLength(1);

    await act(async () => {
      releases[0]?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(updates()).toHaveLength(2);
    });
    expect(updates()[1]).toEqual({ changes: [{ assetId: "a1", percentChange: -4 }] });
    expect(result.current.variables[0]?.percent).toBe(-4);
  });

  it("puts every slider back on Base and saves the empty list at once", async () => {
    const { client, updates } = clientAnswering({
      getScenario: () =>
        Promise.resolve({
          data: scenario([
            { assetId: "a1", percentChange: -10 },
            { assetId: "a2", percentChange: 5 },
          ]),
        }),
    });
    const { result } = await ready(client);

    act(() => {
      result.current.reset();
    });

    expect(result.current.variables.map(({ percent }) => percent)).toEqual([0, 0]);
    await waitFor(() => {
      expect(updates()).toEqual([{ changes: [] }]);
    });
  });

  it("does not lose the last move when the editor closes before the pause is over", async () => {
    const { client, updates } = clientAnswering();
    const { result, unmount } = await ready(client);

    act(() => {
      result.current.setPercent("a1", -10);
    });
    unmount();

    await waitFor(() => {
      expect(updates()).toEqual([{ changes: [{ assetId: "a1", percentChange: -10 }] }]);
    });
  });
});
