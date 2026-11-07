import { fixedClock } from "@trading/application";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWebSocketRealtimeClient } from "@/realtime/websocket-realtime-client";
import { createDemoControls } from "./demo-controls";
import { createDemoRealtimeServer } from "./demo-realtime-server";

function setup() {
  const server = createDemoRealtimeServer({ clock: fixedClock(new Date("2026-01-31T12:00:00Z")) });
  const client = createWebSocketRealtimeClient({
    url: "demo://realtime",
    getAccessToken: () => "demo-token",
    createSocket: server.createSocket,
    // No jitter: the first retry waits exactly one second.
    random: () => 0,
  });
  const controls = createDemoControls({ realtimeServer: server });
  return { server, client, controls };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("demo controls", () => {
  it("loses the connection and gets it back through the real states", async () => {
    const { client, controls } = setup();
    client.connect();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.getState()).toBe("connected");
    const states: string[] = [];
    client.onStateChange(() => states.push(client.getState()));

    controls.simulateConnectionIssue();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.getState()).toBe("reconnecting");

    await vi.advanceTimersByTimeAsync(1_000);

    expect(client.getState()).toBe("connected");
    expect(states).toEqual(["reconnecting", "connected"]);
    client.disconnect();
  });

  it("asks the client to read what it may have missed once it is back", async () => {
    const { client, controls } = setup();
    const resync = vi.fn();
    client.onResync(resync);
    client.connect();
    await vi.advanceTimersByTimeAsync(0);

    controls.simulateConnectionIssue();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(resync).toHaveBeenCalledWith({ reason: "reconnect", channel: null });
    client.disconnect();
  });

  it("does nothing when nobody is connected", () => {
    const { controls } = setup();

    expect(() => {
      controls.simulateConnectionIssue();
    }).not.toThrow();
  });
});
