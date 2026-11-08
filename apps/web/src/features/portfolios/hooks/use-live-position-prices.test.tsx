import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { marketChannelName, type PositionResponse, type RealtimeEvent } from "@trading/contracts";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { portfolioKeys } from "@/hooks/use-portfolios";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { useLivePositionPrices } from "./use-live-position-prices";

const usd = (amount: string) => ({ amount, currency: "USD" });

const WRITTEN = "2026-11-05T14:00:00.000Z";
const LATER = "2026-11-05T14:30:01.000Z";

function position(id: string, assetId: string, price = "180.00"): PositionResponse {
  return {
    id,
    portfolioId: "p1",
    assetId,
    quantity: 10,
    averageEntryPrice: usd("150.00"),
    currentPrice: usd(price),
    openedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: WRITTEN,
  };
}

function tick(assetId: string, amount: string, timestamp = LATER): RealtimeEvent {
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

interface Props {
  portfolioId: string | undefined;
  ids: string[];
}

function setup(props: Props) {
  const client = createFakeRealtimeClient("connected");
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    ({ portfolioId, ids }: Props) => {
      useLivePositionPrices(portfolioId, ids);
    },
    { wrapper, initialProps: props },
  );
  const cached = (portfolioId = "p1") =>
    queryClient.getQueryData<readonly PositionResponse[]>(portfolioKeys.positions(portfolioId));
  return { client, queryClient, cached, ...view };
}

describe("useLivePositionPrices", () => {
  it("listens once to the market channel of each asset, and leaves them when it unmounts", () => {
    const { client, unmount } = setup({ portfolioId: "p1", ids: ["a1", "a2", "a1"] });

    expect(client.subscribedChannels()).toEqual(["market:a1", "market:a2"]);
    unmount();

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("puts a tick in the price of the position of that asset", () => {
    const { client, queryClient, cached } = setup({ portfolioId: "p1", ids: ["a1", "a2"] });
    queryClient.setQueryData(portfolioKeys.positions("p1"), [
      position("s1", "a1"),
      position("s2", "a2", "50.00"),
    ]);

    act(() => {
      client.emit(tick("a1", "181.20"));
    });

    expect(cached()?.[0]?.currentPrice).toEqual(usd("181.20"));
    expect(cached()?.[1]?.currentPrice).toEqual(usd("50.00"));
  });

  it("leaves the positions of other portfolios as they were", () => {
    const { client, queryClient, cached } = setup({ portfolioId: "p1", ids: ["a1"] });
    queryClient.setQueryData(portfolioKeys.positions("p1"), [position("s1", "a1")]);
    queryClient.setQueryData(portfolioKeys.positions("p2"), [position("s9", "a1")]);

    act(() => {
      client.emit(tick("a1", "181.20"));
    });

    expect(cached("p2")?.[0]?.currentPrice).toEqual(usd("180.00"));
  });

  it("leaves a query that has not answered yet without data", () => {
    const { client, queryClient, cached } = setup({ portfolioId: "p1", ids: ["a1"] });
    queryClient.getQueryCache().build(queryClient, { queryKey: portfolioKeys.positions("p1") });

    act(() => {
      client.emit(tick("a1", "181.20"));
    });

    expect(cached()).toBeUndefined();
  });

  it("does not take a position written after the tick back to an older price", () => {
    const { client, queryClient, cached } = setup({ portfolioId: "p1", ids: ["a1"] });
    queryClient.setQueryData(portfolioKeys.positions("p1"), [position("s1", "a1")]);

    act(() => {
      client.emit(tick("a1", "999.00", "2026-11-05T13:00:00.000Z"));
    });

    expect(cached()?.[0]?.currentPrice).toEqual(usd("180.00"));
  });

  it("listens to nothing without a portfolio", () => {
    const { client } = setup({ portfolioId: undefined, ids: ["a1"] });

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("follows the assets when the list changes", () => {
    const { client, rerender } = setup({ portfolioId: "p1", ids: ["a1", "a2"] });

    rerender({ portfolioId: "p1", ids: ["a2", "a3"] });

    expect(client.subscribedChannels().sort()).toEqual(["market:a2", "market:a3"]);
  });

  it("does not listen again when a new array holds the same assets", () => {
    const { client, rerender } = setup({ portfolioId: "p1", ids: ["a1"] });
    const before = client.subscribedChannels();

    rerender({ portfolioId: "p1", ids: ["a1"] });

    expect(client.subscribedChannels()).toEqual(before);
  });
});
