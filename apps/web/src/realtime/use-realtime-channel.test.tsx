import { jobsChannelName, marketChannelName, type RealtimeEvent } from "@trading/contracts";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { RealtimeClientProvider } from "./realtime-client-provider";
import { useRealtimeChannel } from "./use-realtime-channel";

function priceEvent(assetId: string, sequence = 1): RealtimeEvent {
  return {
    id: `e${String(sequence)}`,
    type: "MARKET_PRICE_UPDATED",
    channel: marketChannelName(assetId),
    sequence,
    timestamp: "2026-11-05T14:30:00.000Z",
    epoch: "epoch-1",
    payload: {
      assetId,
      price: { amount: "181.20", currency: "USD" },
      previousPrice: { amount: "176.60", currency: "USD" },
      change: { amount: "4.60", currency: "USD" },
      changePercent: 2.6,
      tickChange: { amount: "0.10", currency: "USD" },
    },
  };
}

function setup() {
  const client = createFakeRealtimeClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
  );
  return { client, wrapper };
}

describe("useRealtimeChannel", () => {
  it("subscribes to the channel and gives the listener its events", () => {
    const { client, wrapper } = setup();
    const onEvent = vi.fn();

    renderHook(
      () => {
        useRealtimeChannel({ kind: "market", assetId: "a1" }, onEvent);
      },
      { wrapper },
    );
    act(() => {
      client.emit(priceEvent("a1"));
    });

    expect(client.subscribedChannels()).toEqual(["market:a1"]);
    expect(onEvent).toHaveBeenCalledWith(priceEvent("a1"));
  });

  it("leaves the channel when the component unmounts", () => {
    const { client, wrapper } = setup();
    const { unmount } = renderHook(
      () => {
        useRealtimeChannel({ kind: "notifications" }, vi.fn());
      },
      { wrapper },
    );

    unmount();

    expect(client.subscribedChannels()).toEqual([]);
  });

  it("does not subscribe again when a new object names the same channel", () => {
    const { client, wrapper } = setup();
    const subscribe = vi.spyOn(client, "subscribe");
    const { rerender } = renderHook(
      () => {
        useRealtimeChannel({ kind: "market", assetId: "a1" }, vi.fn());
      },
      { wrapper },
    );

    rerender();
    rerender();

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("moves to the new channel when the name changes, leaving the old one", () => {
    const { client, wrapper } = setup();
    const { rerender } = renderHook(
      ({ assetId }) => {
        useRealtimeChannel({ kind: "market", assetId }, vi.fn());
      },
      { wrapper, initialProps: { assetId: "a1" } },
    );

    rerender({ assetId: "a2" });

    expect(client.subscribedChannels()).toEqual(["market:a2"]);
  });

  it("calls the latest listener without subscribing again", () => {
    const { client, wrapper } = setup();
    const subscribe = vi.spyOn(client, "subscribe");
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onEvent }) => {
        useRealtimeChannel({ kind: "market", assetId: "a1" }, onEvent);
      },
      { wrapper, initialProps: { onEvent: first } },
    );

    rerender({ onEvent: second });
    act(() => {
      client.emit(priceEvent("a1"));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps the channels of other components apart", () => {
    const { client, wrapper } = setup();
    const onJob = vi.fn();
    renderHook(
      () => {
        useRealtimeChannel({ kind: "jobs", jobId: "j1" }, onJob);
      },
      { wrapper },
    );

    act(() => {
      client.emit(priceEvent("a1"));
    });

    expect(client.subscribedChannels()).toEqual([jobsChannelName("j1")]);
    expect(onJob).not.toHaveBeenCalled();
  });
});
