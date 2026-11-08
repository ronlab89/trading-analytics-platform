import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useOverview } from "./use-overview";

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("useOverview", () => {
  it("gets the overview through the getPortfolioOverview operation with the portfolio id", async () => {
    const overview = { portfolio: { id: "p1" } };
    const { client, call } = clientAnswering(() => Promise.resolve({ data: overview }));
    const { result } = renderHook(() => useOverview("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(overview);
    expect(call.mock.calls[0]?.[0].operationId).toBe("getPortfolioOverview");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("exposes the API error so the view can tell a failure from an empty portfolio", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    );
    const { result } = renderHook(() => useOverview("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "DEPENDENCY_ERROR", status: 503 });
  });

  it("does not call the API while there is no portfolio", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: {} }));
    const { result } = renderHook(() => useOverview(undefined), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(call).not.toHaveBeenCalled();
  });
});
