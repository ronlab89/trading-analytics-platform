import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { ACTIVITY_DAYS, useRecentTransactions } from "./use-recent-transactions";

const transaction = (id: string) => ({ id, portfolioId: "p1", type: "BUY" });

type Answer = (input?: CallInput) => Promise<unknown>;

function clientAnswering(answer: Answer) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => answer(input),
  );
  return { client: { call } as TradingClient, call };
}

/** The API in pages of 100: `total` transactions named t0, t1, and so on. */
function pagesOf(total: number): Answer {
  return (input) => {
    const { page, pageSize } = input?.query as { page: number; pageSize: number };
    const from = (page - 1) * pageSize;
    const count = Math.max(0, Math.min(pageSize, total - from));
    return Promise.resolve({
      data: Array.from({ length: count }, (_, index) => transaction(`t${String(from + index)}`)),
      meta: { page, pageSize, total },
    });
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T15:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRecentTransactions", () => {
  it("asks for the last 30 days of the portfolio, counting from the start of the day", async () => {
    const { client, call } = clientAnswering(pagesOf(3));
    const { result } = renderHook(() => useRecentTransactions("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(ACTIVITY_DAYS).toBe(30);
    expect(call.mock.calls[0]?.[0].operationId).toBe("listTransactions");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { page: 1, pageSize: 100, dateFrom: "2026-10-05" },
    });
    expect(result.current.data).toHaveLength(3);
  });

  it("goes through every page, so the activity has all of them", async () => {
    const { client, call } = clientAnswering(pagesOf(250));
    const { result } = renderHook(() => useRecentTransactions("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call).toHaveBeenCalledTimes(3);
    expect(result.current.data).toHaveLength(250);
    expect(new Set(result.current.data?.map(({ id }) => id)).size).toBe(250);
  });

  it("stops after ten pages, which is a thousand transactions", async () => {
    const { client, call } = clientAnswering(pagesOf(5000));
    const { result } = renderHook(() => useRecentTransactions("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call).toHaveBeenCalledTimes(10);
    expect(result.current.data).toHaveLength(1000);
  });

  it("asks for nothing while there is no portfolio", () => {
    const { client, call } = clientAnswering(pagesOf(3));
    const { result } = renderHook(() => useRecentTransactions(undefined), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(call).not.toHaveBeenCalled();
  });

  it("exposes the API error so the screen can say it failed", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    );
    const { result } = renderHook(() => useRecentTransactions("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});
