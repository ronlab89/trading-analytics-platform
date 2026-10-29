import { act, renderHook, waitFor } from "@testing-library/react";
import type { PortfolioResponse } from "@trading/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useActivePortfolio } from "./use-active-portfolio";

function portfolio(id: string, status: PortfolioResponse["status"] = "ACTIVE"): PortfolioResponse {
  return {
    id,
    userId: "u1",
    name: id,
    description: null,
    baseCurrency: "USD",
    status,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

function renderActivePortfolio(answer: () => Promise<unknown>) {
  const { client } = clientAnswering(answer);
  return renderHook(() => useActivePortfolio(), { wrapper: tradingClientWrapper(client) });
}

beforeEach(() => {
  useActivePortfolioStore.setState(useActivePortfolioStore.getInitialState());
});

describe("useActivePortfolio", () => {
  it("is pending until the list arrives", () => {
    const { result } = renderActivePortfolio(() => new Promise(() => undefined));

    expect(result.current.isPending).toBe(true);
    expect(result.current.active).toBeUndefined();
  });

  it("falls back to the first active portfolio and offers only the active ones", async () => {
    const { result } = renderActivePortfolio(() =>
      Promise.resolve({ data: [portfolio("old", "ARCHIVED"), portfolio("a"), portfolio("b")] }),
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.active?.id).toBe("a");
    expect(result.current.portfolios.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("follows the portfolio the user selects and remembers it", async () => {
    const { result } = renderActivePortfolio(() =>
      Promise.resolve({ data: [portfolio("a"), portfolio("b")] }),
    );
    await waitFor(() => {
      expect(result.current.active?.id).toBe("a");
    });

    act(() => {
      result.current.select("b");
    });

    expect(result.current.active?.id).toBe("b");
    expect(useActivePortfolioStore.getState().selectedId).toBe("b");
  });

  it("has no active portfolio when the user has none", async () => {
    const { result } = renderActivePortfolio(() =>
      Promise.resolve({ data: [portfolio("old", "ARCHIVED")] }),
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.active).toBeUndefined();
    expect(result.current.portfolios).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("reports a failed load and lets the caller retry it", async () => {
    const { client, call } = clientAnswering(() =>
      Promise.reject(new ApiError("NETWORK_ERROR", "down")),
    );
    const { result } = renderHook(() => useActivePortfolio(), {
      wrapper: tradingClientWrapper(client),
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const callsBefore = call.mock.calls.length;

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(call.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
