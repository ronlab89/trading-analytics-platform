import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useMarketPrices } from "./use-market-prices";

const price = (assetId: string) => ({
  assetId,
  price: { amount: "180.70", currency: "USD" },
  previousPrice: { amount: "177.00", currency: "USD" },
  change: { amount: "3.70", currency: "USD" },
  changePercent: 2.1,
  timestamp: "2026-11-03T14:32:07.000Z",
  source: "SIMULATED",
});

function clientAnswering(known: readonly string[]) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => {
      const asked = String(input?.query?.assetIds).split(",");
      return Promise.resolve({ data: asked.filter((id) => known.includes(id)).map(price) });
    },
  );
  return { client: { call } as TradingClient, call };
}

const ids = (count: number) => Array.from({ length: count }, (_, index) => `a${String(index)}`);

describe("useMarketPrices", () => {
  it("returns the price of each asset by its id", async () => {
    const { client, call } = clientAnswering(["a1", "a2"]);
    const { result } = renderHook(() => useMarketPrices(["a1", "a2"]), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.get("a1")?.changePercent).toBe(2.1);
    expect([...(result.current.data?.keys() ?? [])]).toEqual(["a1", "a2"]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("splits more than 50 assets into requests of at most 50", async () => {
    const all = ids(120);
    const { client, call } = clientAnswering(all);
    const { result } = renderHook(() => useMarketPrices(all), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const sizes = call.mock.calls.map(
      ([, input]) => String(input?.query?.assetIds).split(",").length,
    );
    expect(sizes).toEqual([50, 50, 20]);
    expect(result.current.data?.size).toBe(120);
  });

  it("leaves out an asset that has no price yet", async () => {
    const { client } = clientAnswering(["a1"]);
    const { result } = renderHook(() => useMarketPrices(["a1", "a2"]), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.has("a2")).toBe(false);
  });

  it("makes no request while there are no assets", () => {
    const { client, call } = clientAnswering([]);
    const { result } = renderHook(() => useMarketPrices([]), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(call).not.toHaveBeenCalled();
  });

  it("reports the failure when the prices cannot load", async () => {
    const client = {
      call: vi.fn(() => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))),
    } as unknown as TradingClient;
    const { result } = renderHook(() => useMarketPrices(["a1"]), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
