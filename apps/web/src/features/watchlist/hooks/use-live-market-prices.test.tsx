import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  marketChannelName,
  type MarketPriceResponse,
  type RealtimeEvent,
} from "@trading/contracts";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { marketPriceKeys } from "./use-market-prices";
import { useLiveMarketPrices } from "./use-live-market-prices";

const usd = (amount: string) => ({ amount, currency: "USD" });

function priceOf(assetId: string, amount: string, timestamp: string): MarketPriceResponse {
  return {
    assetId,
    price: usd(amount),
    previousPrice: usd("100.00"),
    change: usd("1.00"),
    changePercent: 1,
    timestamp,
    source: "MOCK",
  };
}

function tick(assetId: string, amount: string, timestamp: string): RealtimeEvent {
  return {
    id: "e1",
    type: "MARKET_PRICE_UPDATED",
    channel: marketChannelName(assetId),
    sequence: 1,
    timestamp,
    epoch: "epoch-1",
    payload: {
      assetId,
      price: usd(amount),
      previousPrice: usd("176.60"),
      change: usd("4.60"),
      changePercent: 2.6,
      tickChange: usd("0.10"),
    },
  };
}

const EARLIER = "2026-11-05T14:30:00.000Z";
const LATER = "2026-11-05T14:30:01.000Z";

function setup(assetIds: string[]) {
  const client = createFakeRealtimeClient("connected");
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    ({ ids }) => {
      useLiveMarketPrices(ids);
    },
    { wrapper, initialProps: { ids: assetIds } },
  );
  const cached = (ids: string[]) =>
    queryClient.getQueryData<Map<string, MarketPriceResponse>>(marketPriceKeys.assets(ids));
  return { client, queryClient, cached, ...view };
}

describe("useLiveMarketPrices", () => {
  it("listens to the market channel of each asset, and leaves them when it unmounts", () => {
    const { client, unmount } = setup(["a1", "a2"]);

    expect(client.subscribedChannels()).toEqual(["market:a1", "market:a2"]);
    unmount();

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("puts a tick in the price query that holds the asset", () => {
    const { client, queryClient, cached } = setup(["a1", "a2"]);
    queryClient.setQueryData(
      marketPriceKeys.assets(["a1", "a2"]),
      new Map([
        ["a1", priceOf("a1", "180.00", EARLIER)],
        ["a2", priceOf("a2", "50.00", EARLIER)],
      ]),
    );

    act(() => {
      client.emit(tick("a1", "181.20", LATER));
    });

    expect(cached(["a1", "a2"])?.get("a1")?.price).toEqual(usd("181.20"));
    expect(cached(["a1", "a2"])?.get("a2")?.price).toEqual(usd("50.00"));
  });

  it("patches every query that holds the asset and none that does not", () => {
    const { client, queryClient, cached } = setup(["a1"]);
    const held = () => new Map([["a1", priceOf("a1", "180.00", EARLIER)]]);
    queryClient.setQueryData(marketPriceKeys.assets(["a1"]), held());
    queryClient.setQueryData(marketPriceKeys.assets(["a1", "a3"]), held());
    queryClient.setQueryData(
      marketPriceKeys.assets(["a3"]),
      new Map([["a3", priceOf("a3", "9.00", EARLIER)]]),
    );

    act(() => {
      client.emit(tick("a1", "181.20", LATER));
    });

    expect(cached(["a1"])?.get("a1")?.price).toEqual(usd("181.20"));
    expect(cached(["a1", "a3"])?.get("a1")?.price).toEqual(usd("181.20"));
    expect(cached(["a3"])?.get("a3")?.price).toEqual(usd("9.00"));
    expect(cached(["a3"])?.has("a1")).toBe(false);
  });

  it("leaves a query that has not answered yet without data", () => {
    const { client, queryClient } = setup(["a1"]);
    queryClient.getQueryCache().build(queryClient, { queryKey: marketPriceKeys.assets(["a1"]) });

    act(() => {
      client.emit(tick("a1", "181.20", LATER));
    });

    expect(queryClient.getQueryData(marketPriceKeys.assets(["a1"]))).toBeUndefined();
  });

  it("does not take a fresher snapshot back to an older price", () => {
    const { client, queryClient, cached } = setup(["a1"]);
    queryClient.setQueryData(
      marketPriceKeys.assets(["a1"]),
      new Map([["a1", priceOf("a1", "182.00", LATER)]]),
    );

    act(() => {
      client.emit(tick("a1", "181.20", EARLIER));
    });

    expect(cached(["a1"])?.get("a1")?.price).toEqual(usd("182.00"));
  });

  it("ignores events that are not price ticks", () => {
    const { client, queryClient, cached } = setup(["a1"]);
    const before = new Map([["a1", priceOf("a1", "180.00", EARLIER)]]);
    queryClient.setQueryData(marketPriceKeys.assets(["a1"]), before);

    act(() => {
      client.emit({
        id: "e2",
        type: "PORTFOLIO_UPDATED",
        channel: marketChannelName("a1"),
        sequence: 2,
        timestamp: LATER,
        epoch: "epoch-1",
        payload: { portfolioId: "p1", reason: "TRANSACTION_CREATED" },
      } as unknown as RealtimeEvent);
    });

    expect(cached(["a1"])).toBe(before);
  });

  it("follows the assets when the list changes", () => {
    const { client, rerender } = setup(["a1", "a2"]);

    rerender({ ids: ["a2", "a3"] });

    expect(client.subscribedChannels().sort()).toEqual(["market:a2", "market:a3"]);
  });

  it("does not listen again when a new array holds the same assets", () => {
    const { client, rerender } = setup(["a1"]);
    const before = client.subscribedChannels();

    rerender({ ids: ["a1"] });

    expect(client.subscribedChannels()).toEqual(before);
  });
});
