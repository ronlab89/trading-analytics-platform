import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { marketChannelName, type OverviewResponse, type RealtimeEvent } from "@trading/contracts";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { useLiveOverviewPrices } from "./use-live-overview-prices";
import { overviewKeys } from "./use-overview";

const usd = (amount: string) => ({ amount, currency: "USD" });

const LATER = "2026-11-05T14:30:01.000Z";

function overview(): OverviewResponse {
  return {
    portfolio: {
      id: "p1",
      userId: "u1",
      name: "Main",
      description: null,
      baseCurrency: "USD",
      status: "ACTIVE",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    summary: {
      totalValue: usd("1800.00"),
      investedValue: usd("1800.00"),
      unrealizedPnL: usd("300.00"),
      unrealizedPnLPercent: 20,
    },
    positions: [
      {
        position: {
          id: "s1",
          portfolioId: "p1",
          assetId: "a1",
          quantity: 10,
          averageEntryPrice: usd("150.00"),
          currentPrice: usd("180.00"),
          openedAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-11-05T14:00:00.000Z",
        },
        asset: null,
        metrics: {
          marketValue: usd("1800.00"),
          costBasis: usd("1500.00"),
          unrealizedPnL: usd("300.00"),
          unrealizedPnLPercent: 20,
        },
        allocationPercent: 100,
        dailyChange: null,
      },
    ],
  } as unknown as OverviewResponse;
}

function tick(assetId: string, amount: string): RealtimeEvent {
  return {
    id: "e1",
    type: "MARKET_PRICE_UPDATED",
    channel: marketChannelName(assetId),
    sequence: 1,
    timestamp: LATER,
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

function setup(portfolioId: string | undefined) {
  const client = createFakeRealtimeClient("connected");
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    () => {
      useLiveOverviewPrices(portfolioId, ["a1"]);
    },
    { wrapper },
  );
  const cached = () => queryClient.getQueryData<OverviewResponse>(overviewKeys.portfolio("p1"));
  return { client, queryClient, cached, ...view };
}

describe("useLiveOverviewPrices", () => {
  it("listens to the market channel of the asset, and leaves it when it unmounts", () => {
    const { client, unmount } = setup("p1");

    expect(client.subscribedChannels()).toEqual(["market:a1"]);
    unmount();

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("puts a tick in the position price, its metrics and the summary", () => {
    const { client, queryClient, cached } = setup("p1");
    queryClient.setQueryData(overviewKeys.portfolio("p1"), overview());

    act(() => {
      client.emit(tick("a1", "190.00"));
    });

    expect(cached()?.positions[0]?.position.currentPrice).toEqual(usd("190.00"));
    expect(Number(cached()?.positions[0]?.metrics.marketValue.amount)).toBe(1900);
    expect(Number(cached()?.summary.totalValue.amount)).toBe(1900);
    expect(Number(cached()?.summary.unrealizedPnL.amount)).toBe(400);
  });

  it("leaves a query that has not answered yet without data", () => {
    const { client, queryClient, cached } = setup("p1");
    queryClient.getQueryCache().build(queryClient, { queryKey: overviewKeys.portfolio("p1") });

    act(() => {
      client.emit(tick("a1", "190.00"));
    });

    expect(cached()).toBeUndefined();
  });

  it("listens to nothing without a portfolio", () => {
    const { client } = setup(undefined);

    expect(client.subscribedChannels()).toEqual([]);
  });
});
