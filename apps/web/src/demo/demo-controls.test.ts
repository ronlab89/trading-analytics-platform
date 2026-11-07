import { fixedClock } from "@trading/application";
import type { RealtimePublisher } from "@trading/application";
import { NotificationSeverity } from "@trading/domain";
import { InMemoryNotificationRepository } from "@trading/persistence-memory";
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
  const notificationRepository = new InMemoryNotificationRepository();
  const notificationCreated = vi.fn<RealtimePublisher["notificationCreated"]>(() =>
    Promise.resolve(),
  );
  const controls = createDemoControls({
    realtimeServer: server,
    notificationRepository,
    realtimePublisher: { notificationCreated },
    userId: "demo-user",
  });
  return { server, client, controls, notificationRepository, notificationCreated };
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

  it("stores a test notification for the user and publishes it", async () => {
    const { controls, notificationRepository, notificationCreated } = setup();

    await controls.sendTestNotification();

    const stored = await notificationRepository.listByUserId("demo-user");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      userId: "demo-user",
      title: "Test notification",
      severity: NotificationSeverity.INFO,
      readAt: null,
    });
    expect(notificationCreated).toHaveBeenCalledWith(stored[0]);
  });

  it("does nothing when nobody is connected", () => {
    const { controls } = setup();

    expect(() => {
      controls.simulateConnectionIssue();
    }).not.toThrow();
  });
});
