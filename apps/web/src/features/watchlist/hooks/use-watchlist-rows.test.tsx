import { marketChannelName, type RealtimeEvent } from "@trading/contracts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useWatchlistRows } from "./use-watchlist-rows";

const item = (assetId: string) => ({
  id: `w-${assetId}`,
  userId: "u1",
  assetId,
  createdAt: "2026-11-01T10:00:00.000Z",
});

const asset = (id: string, symbol: string, name: string, assetType = "STOCK") => ({
  id,
  symbol,
  name,
  assetType,
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
});

const price = (assetId: string, amount: string, changePercent: number) => ({
  assetId,
  price: { amount, currency: "USD" },
  previousPrice: { amount, currency: "USD" },
  change: { amount: "0.00", currency: "USD" },
  changePercent,
  timestamp: "2026-11-03T14:32:07.000Z",
  source: "SIMULATED",
});

interface Answers {
  watchlist?: () => Promise<unknown>;
  asset?: (assetId: string) => Promise<unknown>;
  prices?: () => Promise<unknown>;
}

const assets = new Map([
  ["a1", asset("a1", "AAPL", "Apple Inc.")],
  ["a2", asset("a2", "SPY", "SPDR S&P 500 ETF", "ETF")],
]);

function clientWith({ watchlist, asset: assetAnswer, prices }: Answers) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listWatchlist":
          return watchlist?.() ?? Promise.resolve({ data: [item("a1"), item("a2")] });
        case "getAsset": {
          const id = String(input?.params?.assetId);
          return assetAnswer?.(id) ?? Promise.resolve({ data: assets.get(id) });
        }
        default:
          return (
            prices?.() ??
            Promise.resolve({ data: [price("a1", "180.70", 2.1), price("a2", "560.20", 0.5)] })
          );
      }
    },
  );
  return { client: { call } as TradingClient, call };
}

function render(answers: Answers, realtime = createFakeRealtimeClient("connected")) {
  const { client, call } = clientWith(answers);
  const view = renderHook(() => useWatchlistRows(), {
    wrapper: tradingClientWrapper(client, undefined, realtime),
  });
  return { ...view, call, realtime };
}
function tick(assetId: string, amount: string, changePercent: number): RealtimeEvent {
  return {
    id: "e1",
    type: "MARKET_PRICE_UPDATED",
    channel: marketChannelName(assetId),
    sequence: 1,
    timestamp: "2026-11-05T14:30:00.000Z",
    epoch: "epoch-1",
    payload: {
      assetId,
      price: { amount, currency: "USD" },
      previousPrice: { amount: "170.00", currency: "USD" },
      change: { amount: "1.00", currency: "USD" },
      changePercent,
      tickChange: { amount: "0.10", currency: "USD" },
    },
  };
}

describe("useWatchlistRows", () => {
  it("joins each watched asset with its details and its price", async () => {
    const { result } = render({});

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.rows).toEqual([
      {
        assetId: "a1",
        symbol: "AAPL",
        name: "Apple Inc.",
        assetType: "STOCK",
        exchange: "NASDAQ",
        price: { amount: "180.70", currency: "USD" },
        changePercent: 2.1,
      },
      {
        assetId: "a2",
        symbol: "SPY",
        name: "SPDR S&P 500 ETF",
        assetType: "ETF",
        exchange: "NASDAQ",
        price: { amount: "560.20", currency: "USD" },
        changePercent: 0.5,
      },
    ]);
  });

  it("updates the row of an asset with each tick, and no other row", async () => {
    const { result, realtime } = render({});
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    act(() => {
      realtime.emit(tick("a1", "181.20", 2.6));
    });

    // The query cache tells the components on the next tick of the event loop.
    await waitFor(() => {
      expect(result.current.rows?.[0]).toMatchObject({
        assetId: "a1",
        price: { amount: "181.20", currency: "USD" },
        changePercent: 2.6,
      });
    });
    expect(result.current.rows?.[1]).toMatchObject({
      assetId: "a2",
      price: { amount: "560.20", currency: "USD" },
    });
  });

  it("listens to the market channel of each watched asset and leaves them on unmount", async () => {
    const { result, realtime, unmount } = render({});
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(realtime.subscribedChannels()).toEqual(["market:a1", "market:a2"]);
    unmount();

    expect(realtime.subscribedChannels()).toEqual([]);
  });

  it("has no rows while the assets and prices are loading", () => {
    const { result } = render({ prices: () => new Promise(() => undefined) });

    expect(result.current.isPending).toBe(true);
    expect(result.current.rows).toBeUndefined();
  });

  it("is not pending and has no rows for an empty watchlist", async () => {
    const { result, call } = render({ watchlist: () => Promise.resolve({ data: [] }) });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.rows).toEqual([]);
    expect(call.mock.calls.map(([operation]) => operation.operationId)).toEqual(["listWatchlist"]);
  });

  it("keeps the row with a null price when the prices fail", async () => {
    const { result } = render({
      prices: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.rows?.[0]).toMatchObject({
      symbol: "AAPL",
      price: null,
      changePercent: null,
    });
  });

  it("keeps the row with a null symbol and name when an asset fails", async () => {
    const { result } = render({
      asset: (id) =>
        id === "a1"
          ? Promise.reject(new ApiError("NOT_FOUND", "No such asset"))
          : Promise.resolve({ data: assets.get(id) }),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.rows?.[0]).toMatchObject({ assetId: "a1", symbol: null, name: null });
    expect(result.current.rows?.[1]).toMatchObject({ symbol: "SPY" });
  });

  it("is an error when the watchlist cannot load", async () => {
    const { result } = render({
      watchlist: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.rows).toBeUndefined();
  });
});
