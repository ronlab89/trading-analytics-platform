import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useScenarioRows } from "./use-scenario-rows";

const usd = (amount: string) => ({ amount, currency: "USD" });

function scenario(id: string, assetId: string, percentChange: number, status = "SAVED") {
  return {
    id,
    portfolioId: "p1",
    name: `Scenario ${id}`,
    description: null,
    baseSnapshotId: null,
    status,
    changes: [{ assetId, percentChange }],
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-12T10:00:00.000Z",
  };
}

function calculation(scenarioId: string, result: string) {
  const metrics = (total: string) => ({
    totalValue: usd(total),
    investedValue: usd("100000.00"),
    unrealizedPnL: usd("0.00"),
    unrealizedPnLPercent: 0,
  });
  return {
    scenarioId,
    baseline: metrics("1000.00"),
    result: metrics(result),
    difference: { totalValue: usd("0.00"), unrealizedPnL: usd("0.00") },
    unmatchedAssetIds: [],
  };
}

type Answers = Partial<Record<string, (input?: CallInput) => Promise<unknown>>>;

function clientAnswering(answers: Answers) {
  const call = vi.fn((operation: { operationId: string }, input?: CallInput) => {
    const answer = answers[operation.operationId];
    return answer === undefined
      ? Promise.reject(new Error(`unexpected ${operation.operationId}`))
      : answer(input);
  });
  return { client: { call } as unknown as TradingClient, call };
}

const getAsset = (input?: CallInput) =>
  Promise.resolve({ data: { id: input?.params?.assetId, symbol: "AAPL", name: "Apple" } });

describe("useScenarioRows", () => {
  it("has no rows until the scenarios and their assets are in", async () => {
    const { client } = clientAnswering({
      listScenarios: () => Promise.resolve({ data: [scenario("s1", "a1", -10)] }),
      getAsset,
      calculateScenario: () => new Promise(() => undefined),
    });
    const { result } = renderHook(() => useScenarioRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.rows).toBeUndefined();
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.rows?.[0]?.mainChange?.symbol).toBe("AAPL");
  });

  it("shows a row before its figures, and fills them when the calculation comes back", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    const { client } = clientAnswering({
      listScenarios: () => Promise.resolve({ data: [scenario("s1", "a1", -10)] }),
      getAsset,
      calculateScenario: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const { result } = renderHook(() => useScenarioRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.rows?.[0]?.figures).toBeNull();
    expect(result.current.rows?.[0]?.figuresState).toBe("loading");

    resolve({ data: calculation("s1", "900.00") });

    await waitFor(() => {
      expect(result.current.rows?.[0]?.figures?.withScenario).toEqual(usd("900.00"));
    });
  });

  it("asks for the calculation of every scenario, once each", async () => {
    const { client, call } = clientAnswering({
      listScenarios: () =>
        Promise.resolve({ data: [scenario("s1", "a1", -10), scenario("s2", "a1", 5)] }),
      getAsset,
      calculateScenario: (input) =>
        Promise.resolve({ data: calculation(String(input?.params?.scenarioId), "1000.00") }),
    });
    const { result } = renderHook(() => useScenarioRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.rows?.every((row) => row.figures !== null)).toBe(true);
    });
    const calculated = call.mock.calls
      .filter(([operation]) => operation.operationId === "calculateScenario")
      .map(([, input]) => input?.params?.scenarioId);
    expect(calculated.sort()).toEqual(["s1", "s2"]);
  });

  it("flags a scenario whose calculation fails and keeps the figures of the others", async () => {
    const { client } = clientAnswering({
      listScenarios: () =>
        Promise.resolve({ data: [scenario("s1", "a1", -10), scenario("s2", "a1", 5)] }),
      getAsset,
      calculateScenario: (input) =>
        input?.params?.scenarioId === "s1"
          ? Promise.reject(new Error("boom"))
          : Promise.resolve({ data: calculation("s2", "1100.00") }),
    });
    const { result } = renderHook(() => useScenarioRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.rows?.find((row) => row.id === "s1")?.figuresState).toBe("failed");
    });
    await waitFor(() => {
      expect(result.current.rows?.find((row) => row.id === "s2")?.figures).not.toBeNull();
    });
    expect(result.current.rows?.find((row) => row.id === "s1")?.figures).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("leaves out the archived scenarios and does not calculate them", async () => {
    const { client, call } = clientAnswering({
      listScenarios: () =>
        Promise.resolve({
          data: [scenario("s1", "a1", -10), scenario("s2", "a1", 5, "ARCHIVED")],
        }),
      getAsset,
      calculateScenario: (input) =>
        Promise.resolve({ data: calculation(String(input?.params?.scenarioId), "1000.00") }),
    });
    const { result } = renderHook(() => useScenarioRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.rows?.[0]?.figures).toBeTruthy();
    });
    expect(result.current.rows?.map((row) => row.id)).toEqual(["s1"]);
    const calculated = call.mock.calls.filter(
      ([operation]) => operation.operationId === "calculateScenario",
    );
    expect(calculated).toHaveLength(1);
  });

  it("is an error when the scenarios cannot be listed", async () => {
    const { client } = clientAnswering({
      listScenarios: () => Promise.reject(new Error("down")),
    });
    const { result } = renderHook(() => useScenarioRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.rows).toBeUndefined();
  });
});
