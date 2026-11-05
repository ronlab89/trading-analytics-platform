import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { portfolioChannelName, type RealtimeEvent } from "@trading/contracts";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { overviewKeys } from "@/features/dashboard/hooks/use-overview";
import { portfolioKeys } from "@/hooks/use-portfolios";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { usePortfolioUpdates } from "./use-portfolio-updates";

function update(portfolioId: string, type = "PORTFOLIO_UPDATED"): RealtimeEvent {
  return {
    id: "e1",
    type,
    channel: portfolioChannelName(portfolioId),
    sequence: 1,
    timestamp: "2026-11-05T14:30:01.000Z",
    epoch: "epoch-1",
    payload: { portfolioId, reason: "TRANSACTION_COMMITTED" },
  } as unknown as RealtimeEvent;
}

function setup(initial: { portfolioId: string | undefined }) {
  const client = createFakeRealtimeClient("connected");
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    ({ portfolioId }: { portfolioId: string | undefined }) => {
      usePortfolioUpdates(portfolioId);
    },
    { wrapper, initialProps: initial },
  );
  queryClient.setQueryData(overviewKeys.portfolio("p1"), "data");
  queryClient.setQueryData(portfolioKeys.positions("p1"), "data");
  queryClient.setQueryData(overviewKeys.portfolio("p2"), "data");
  const stale = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated;
  return { client, stale, ...view };
}

describe("usePortfolioUpdates", () => {
  it("listens to the channel of the portfolio, and leaves it when it unmounts", () => {
    const { client, unmount } = setup({ portfolioId: "p1" });

    expect(client.subscribedChannels()).toEqual(["portfolio:p1"]);
    unmount();

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("marks the data of the portfolio as stale when the server says it changed", () => {
    const { client, stale } = setup({ portfolioId: "p1" });

    act(() => {
      client.emit(update("p1"));
    });

    expect(stale(overviewKeys.portfolio("p1"))).toBe(true);
    expect(stale(portfolioKeys.positions("p1"))).toBe(true);
  });

  it("leaves another portfolio alone", () => {
    const { client, stale } = setup({ portfolioId: "p1" });

    act(() => {
      client.emit(update("p1"));
    });

    expect(stale(overviewKeys.portfolio("p2"))).toBe(false);
  });

  it("ignores events that are not portfolio updates", () => {
    const { client, stale } = setup({ portfolioId: "p1" });

    act(() => {
      client.emit(update("p1", "MARKET_PRICE_UPDATED"));
    });

    expect(stale(overviewKeys.portfolio("p1"))).toBe(false);
  });

  it("listens to nothing without a portfolio", () => {
    const { client } = setup({ portfolioId: undefined });

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("follows the portfolio when it changes", () => {
    const { client, rerender } = setup({ portfolioId: "p1" });

    rerender({ portfolioId: "p2" });

    expect(client.subscribedChannels()).toEqual(["portfolio:p2"]);
  });
});
