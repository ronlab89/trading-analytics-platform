import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { scenarioKeys } from "./use-scenarios";
import { useScenarioComparison } from "./use-scenario-comparison";
import { useUpdateScenario } from "./use-update-scenario";

const usd = (amount: string) => ({ amount, currency: "USD" });

const metrics = (total: string) => ({
  totalValue: usd(total),
  investedValue: usd("900.00"),
  unrealizedPnL: usd("0.00"),
  unrealizedPnLPercent: 0,
});

const comparison = {
  baseline: { metrics: metrics("1000.00"), assets: [] },
  scenarios: [
    {
      scenarioId: "s1",
      name: "Apple falls",
      status: "SAVED",
      metrics: metrics("900.00"),
      difference: {
        totalValue: usd("-100.00"),
        totalValuePercent: -10,
        unrealizedPnL: usd("-100.00"),
      },
      assets: [],
      unmatchedAssetIds: [],
    },
  ],
};

function clientWith(compare: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn((operation: { operationId: string }, input?: CallInput) =>
    operation.operationId === "compareScenarios"
      ? compare(input)
      : operation.operationId === "updateScenario"
        ? Promise.resolve({ data: { id: "s1", changes: [] } })
        : Promise.reject(new Error(`unexpected ${operation.operationId}`)),
  );
  const compared = () =>
    call.mock.calls.filter(([operation]) => operation.operationId === "compareScenarios");
  return { client: { call } as unknown as TradingClient, compared };
}

function setup<T>(client: TradingClient, useHook: () => T) {
  const queryClient: QueryClient = createQueryClient();
  const view = renderHook(useHook, { wrapper: tradingClientWrapper(client, queryClient) });
  return { ...view, queryClient };
}

describe("useScenarioComparison", () => {
  it("asks for the scenarios in the order given and answers with the comparison", async () => {
    const { client, compared } = clientWith(() => Promise.resolve({ data: comparison }));
    const { result } = setup(client, () => useScenarioComparison("p1", ["s2", "s1"]));

    await waitFor(() => {
      expect(result.current.data).toEqual(comparison);
    });
    expect(compared()).toHaveLength(1);
    expect(compared()[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      body: { scenarioIds: ["s2", "s1"] },
    });
  });

  it("keeps the order in the key, so the same scenarios in another order are another comparison", () => {
    expect(scenarioKeys.compare("p1", ["s1", "s2"])).not.toEqual(
      scenarioKeys.compare("p1", ["s2", "s1"]),
    );
    expect(scenarioKeys.compare("p1", ["s1"]).slice(0, 3)).toEqual(scenarioKeys.comparisons("p1"));
  });

  it.each([
    ["none", []],
    ["more than five", ["a", "b", "c", "d", "e", "f"]],
    ["a repeated one", ["a", "a"]],
  ])("does not ask when it is given %s", (_label, ids) => {
    const { client, compared } = clientWith(() => Promise.resolve({ data: comparison }));
    const { result } = setup(client, () => useScenarioComparison("p1", ids));

    expect(result.current.fetchStatus).toBe("idle");
    expect(compared()).toHaveLength(0);
  });

  it("fails with the error of the request", async () => {
    const { client } = clientWith(() => Promise.reject(new Error("down")));
    const { result } = setup(client, () => useScenarioComparison("p1", ["s1"]));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("is asked again after the changes of a scenario are saved, so it never shows old figures", async () => {
    const { client, compared } = clientWith(() => Promise.resolve({ data: comparison }));
    const { result } = setup(client, () => ({
      comparison: useScenarioComparison("p1", ["s1"]),
      update: useUpdateScenario("p1", "s1"),
    }));
    await waitFor(() => {
      expect(result.current.comparison.data).toBeDefined();
    });
    expect(compared()).toHaveLength(1);

    result.current.update.mutate({ changes: [] });

    await waitFor(() => {
      expect(compared()).toHaveLength(2);
    });
  });

  it("is not asked again when only the name changes", async () => {
    const { client, compared } = clientWith(() => Promise.resolve({ data: comparison }));
    const { result } = setup(client, () => ({
      comparison: useScenarioComparison("p1", ["s1"]),
      update: useUpdateScenario("p1", "s1"),
    }));
    await waitFor(() => {
      expect(result.current.comparison.data).toBeDefined();
    });

    result.current.update.mutate({ name: "Renamed" });
    await waitFor(() => {
      expect(result.current.update.isSuccess).toBe(true);
    });

    expect(compared()).toHaveLength(1);
  });
});
