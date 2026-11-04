import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useScenarioImpact } from "./use-scenario-impact";
import { useScenarios } from "./use-scenarios";

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("useScenarios", () => {
  it("lists the scenarios of the portfolio", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: [{ id: "s1" }] }));
    const { result } = renderHook(() => useScenarios("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([{ id: "s1" }]);
    expect(call.mock.calls[0]?.[0].operationId).toBe("listScenarios");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("stays idle while there is no portfolio", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: [] }));
    const { result } = renderHook(() => useScenarios(undefined), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(call).not.toHaveBeenCalled();
  });
});

describe("useScenarioImpact", () => {
  it("calculates one scenario of the portfolio", async () => {
    const calculation = { scenarioId: "s1" };
    const { client, call } = clientAnswering(() => Promise.resolve({ data: calculation }));
    const { result } = renderHook(() => useScenarioImpact("p1", "s1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(calculation);
    expect(call.mock.calls[0]?.[0].operationId).toBe("calculateScenario");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1", scenarioId: "s1" } });
  });
});
