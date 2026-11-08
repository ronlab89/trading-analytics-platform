import { renderHook, waitFor } from "@testing-library/react";
import type { PortfolioResponse, PositionResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { usePortfolio } from "./use-portfolio";
import { usePositions } from "./use-positions";

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

const money = { amount: "180.70", currency: "USD" };

const apple: PositionResponse = {
  id: "pos1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 236,
  averageEntryPrice: { amount: "162.40", currency: "USD" },
  currentPrice: money,
  openedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("usePortfolio", () => {
  it("gets the portfolio through the getPortfolio operation with its id", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: growth }));
    const { result } = renderHook(() => usePortfolio("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(growth);
    expect(call.mock.calls[0]?.[0].operationId).toBe("getPortfolio");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("exposes the API error so the view can tell a missing portfolio from a failure", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("NOT_FOUND", "Portfolio not found", 404)),
    );
    const { result } = renderHook(() => usePortfolio("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("does not call the API while there is no id", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: growth }));
    const { result } = renderHook(() => usePortfolio(undefined), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(call).not.toHaveBeenCalled();
  });
});

describe("usePositions", () => {
  it("lists the positions through the listPositions operation with the portfolio id", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: [apple] }));
    const { result } = renderHook(() => usePositions("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([apple]);
    expect(call.mock.calls[0]?.[0].operationId).toBe("listPositions");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("exposes the API error so the view can tell a failure from an empty list", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    );
    const { result } = renderHook(() => usePositions("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "DEPENDENCY_ERROR", status: 503 });
  });

  it("does not call the API while there is no id", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: [apple] }));
    const { result } = renderHook(() => usePositions(undefined), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(call).not.toHaveBeenCalled();
  });
});
