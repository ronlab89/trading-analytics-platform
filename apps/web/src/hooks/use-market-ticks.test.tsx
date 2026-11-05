import { marketChannelName, type RealtimeEvent } from "@trading/contracts";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { useMarketTicks } from "./use-market-ticks";

const usd = (amount: string) => ({ amount, currency: "USD" });

function event(type: string, assetId: string): RealtimeEvent {
  return {
    id: "e1",
    type,
    channel: marketChannelName(assetId),
    sequence: 1,
    timestamp: "2026-11-05T14:30:01.000Z",
    epoch: "epoch-1",
    payload: {
      assetId,
      price: usd("181.20"),
      previousPrice: usd("176.60"),
      change: usd("4.60"),
      changePercent: 2.6,
      tickChange: usd("0.10"),
    },
  } as unknown as RealtimeEvent;
}

interface Props {
  ids: string[];
  enabled?: boolean;
}

function setup(props: Props) {
  const client = createFakeRealtimeClient("connected");
  const onTick = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
  );
  const view = renderHook(
    ({ ids, enabled }: Props) => {
      useMarketTicks(ids, onTick, enabled);
    },
    { wrapper, initialProps: props },
  );
  return { client, onTick, ...view };
}

describe("useMarketTicks", () => {
  it("listens once to the market channel of each distinct asset, and leaves them on unmount", () => {
    const { client, unmount } = setup({ ids: ["a1", "a2", "a1"] });

    expect(client.subscribedChannels()).toEqual(["market:a1", "market:a2"]);
    unmount();

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("hands every price tick to the callback", () => {
    const { client, onTick } = setup({ ids: ["a1"] });

    act(() => {
      client.emit(event("MARKET_PRICE_UPDATED", "a1"));
    });

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({ type: "MARKET_PRICE_UPDATED" }));
  });

  it("ignores events that are not price ticks", () => {
    const { client, onTick } = setup({ ids: ["a1"] });

    act(() => {
      client.emit(event("PORTFOLIO_UPDATED", "a1"));
    });

    expect(onTick).not.toHaveBeenCalled();
  });

  it("listens to nothing when it is not enabled", () => {
    const { client } = setup({ ids: ["a1"], enabled: false });

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("follows the assets when the list changes", () => {
    const { client, rerender } = setup({ ids: ["a1", "a2"] });

    rerender({ ids: ["a2", "a3"] });

    expect(client.subscribedChannels().sort()).toEqual(["market:a2", "market:a3"]);
  });

  it("does not listen again when a new array holds the same assets", () => {
    const { client, rerender } = setup({ ids: ["a1"] });
    const before = client.subscribedChannels();

    rerender({ ids: ["a1"] });

    expect(client.subscribedChannels()).toEqual(before);
  });
});
