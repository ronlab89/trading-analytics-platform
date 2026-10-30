import { renderHook, waitFor } from "@testing-library/react";
import type { PortfolioResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { usePortfolios } from "./use-portfolios";

const growth: PortfolioResponse = {
  id: "p1",
  userId: "u1",
  name: "Growth",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("usePortfolios", () => {
  it("lists the portfolios of the user through the listPortfolios operation", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: [growth] }));
    const { result } = renderHook(() => usePortfolios(), { wrapper: tradingClientWrapper(client) });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([growth]);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[0].operationId).toBe("listPortfolios");
  });

  it("exposes the API error so the view can tell a failure from an empty list", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    );
    const { result } = renderHook(() => usePortfolios(), { wrapper: tradingClientWrapper(client) });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "DEPENDENCY_ERROR", status: 503 });
  });
});
