import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { type PerformancePeriod, usePerformance } from "./use-performance";

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("usePerformance", () => {
  it("gets the performance through the getPortfolioPerformance operation with the portfolio and the period", async () => {
    const performance = { status: "OK", series: [] };
    const { client, call } = clientAnswering(() => Promise.resolve({ data: performance }));
    const { result } = renderHook(() => usePerformance("p1", "3M"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(performance);
    expect(call.mock.calls[0]?.[0].operationId).toBe("getPortfolioPerformance");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { period: "3M" },
    });
  });

  it("asks again when the period changes, and keeps the last answer on screen meanwhile", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: { series: [] } }));
    const { result, rerender } = renderHook(
      ({ period }: { period: PerformancePeriod }) => usePerformance("p1", period),
      { initialProps: { period: "1M" }, wrapper: tradingClientWrapper(client) },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    rerender({ period: "1W" });

    expect(result.current.data).toEqual({ series: [] });
    await waitFor(() => {
      expect(call).toHaveBeenCalledTimes(2);
    });
    expect(call.mock.calls[1]?.[1]).toMatchObject({ query: { period: "1W" } });
  });

  it("exposes the API error so a panel can say it failed", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    );
    const { result } = renderHook(() => usePerformance("p1", "1M"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "DEPENDENCY_ERROR", status: 503 });
  });

  it("does not call the API while there is no portfolio", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: {} }));
    const { result } = renderHook(() => usePerformance(undefined, "1M"), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(call).not.toHaveBeenCalled();
  });
});
