import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { useAllocation } from "./use-allocation";
import { usePeriodPerformance } from "./use-period-performance";
import { useRisk } from "./use-risk";

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

const month: AnalyticsPeriod = { kind: "preset", period: "1M" };
const range: AnalyticsPeriod = { kind: "custom", from: "2026-10-01", to: "2026-10-14" };

describe("usePeriodPerformance", () => {
  it("gets the performance of a preset through getPortfolioPerformance", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: { series: [] } }));
    const { result } = renderHook(() => usePeriodPerformance("p1", month), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call.mock.calls[0]?.[0].operationId).toBe("getPortfolioPerformance");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { period: "1M" },
    });
  });

  it("sends a custom range as `from` and `to`, and asks again when it changes", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: { series: [] } }));
    const { result, rerender } = renderHook(
      ({ period }: { period: AnalyticsPeriod }) => usePeriodPerformance("p1", period),
      { initialProps: { period: month as AnalyticsPeriod }, wrapper: tradingClientWrapper(client) },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    rerender({ period: range });

    expect(result.current.data).toEqual({ series: [] });
    await waitFor(() => {
      expect(call).toHaveBeenCalledTimes(2);
    });
    expect(call.mock.calls[1]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { from: "2026-10-01", to: "2026-10-14" },
    });
  });

  it("stays idle without a portfolio", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: {} }));
    renderHook(() => usePeriodPerformance(undefined, month), {
      wrapper: tradingClientWrapper(client),
    });

    expect(call).not.toHaveBeenCalled();
  });
});

describe("useRisk", () => {
  it("gets the risk of the period through getPortfolioRisk", async () => {
    const risk = { status: "OK", volatilityPercent: 14.2, maxDrawdownPercent: -8.4 };
    const { client, call } = clientAnswering(() => Promise.resolve({ data: risk }));
    const { result } = renderHook(() => useRisk("p1", range), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(risk);
    expect(call.mock.calls[0]?.[0].operationId).toBe("getPortfolioRisk");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { from: "2026-10-01", to: "2026-10-14" },
    });
  });

  it("reports a failure", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    );
    const { result } = renderHook(() => useRisk("p1", month), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useAllocation", () => {
  it("gets the allocation grouped as asked, with no period", async () => {
    const { client, call } = clientAnswering(() =>
      Promise.resolve({ data: { groupBy: "assetType", groups: [] } }),
    );
    const { result } = renderHook(() => useAllocation("p1", "assetType"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call.mock.calls[0]?.[0].operationId).toBe("getPortfolioAllocation");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { groupBy: "assetType" },
    });
  });
});
