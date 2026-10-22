import { describe, expect, it } from "vitest";
import { createRealtimeHub } from "./realtime-hub.js";
import type { HubSubscriber } from "./realtime-hub.js";

interface Received {
  id: string;
  type: string;
  channel: string;
  sequence: number;
  timestamp: string;
  epoch: string;
  payload: unknown;
}

class Subscriber implements HubSubscriber {
  readonly received: Received[] = [];

  constructor(
    readonly userId: string,
    private readonly accepts: () => boolean = () => true,
  ) {}

  send(message: unknown): boolean {
    this.received.push(message as Received);
    return this.accepts();
  }
}

function build() {
  let counter = 0;
  return createRealtimeHub({
    clock: { now: () => new Date("2026-03-01T12:00:00.000Z") },
    newId: () => `event-${(++counter).toString()}`,
    epoch: "boot-1",
  });
}

const price = (channel = "market:a1") =>
  ({ type: "MARKET_PRICE_UPDATED", channel, payload: { n: 1 } }) as const;

describe("realtime hub", () => {
  it("delivers an event to the subscribed sockets only", () => {
    const hub = build();
    const subscribed = new Subscriber("u1");
    const other = new Subscriber("u2");
    const unsubscribed = new Subscriber("u3");
    hub.subscribe(subscribed, "market:a1");
    hub.subscribe(other, "market:a2");

    hub.publish(price());

    expect(subscribed.received).toHaveLength(1);
    expect(other.received).toHaveLength(0);
    expect(unsubscribed.received).toHaveLength(0);
  });

  it("wraps the payload in the envelope with the epoch", () => {
    const hub = build();
    const socket = new Subscriber("u1");
    hub.subscribe(socket, "market:a1");

    hub.publish(price());

    expect(socket.received[0]).toEqual({
      id: "event-1",
      type: "MARKET_PRICE_UPDATED",
      channel: "market:a1",
      sequence: 1,
      timestamp: "2026-03-01T12:00:00.000Z",
      epoch: "boot-1",
      payload: { n: 1 },
    });
  });

  it("numbers each channel on its own, one by one", () => {
    const hub = build();
    const socket = new Subscriber("u1");
    hub.subscribe(socket, "market:a1");
    hub.subscribe(socket, "market:a2");

    hub.publish(price("market:a1"));
    hub.publish(price("market:a2"));
    hub.publish(price("market:a1"));

    expect(socket.received.map((event) => [event.channel, event.sequence])).toEqual([
      ["market:a1", 1],
      ["market:a2", 1],
      ["market:a1", 2],
    ]);
  });

  it("gives every socket of a channel the same sequence", () => {
    const hub = build();
    const first = new Subscriber("u1");
    const second = new Subscriber("u2");
    hub.subscribe(first, "market:a1");
    hub.subscribe(second, "market:a1");

    hub.publish(price());

    expect(first.received[0]?.sequence).toBe(1);
    expect(second.received[0]?.sequence).toBe(1);
  });

  it("does not use a sequence number when nobody is subscribed", () => {
    const hub = build();
    const socket = new Subscriber("u1");

    hub.publish(price());
    hub.subscribe(socket, "market:a1");
    hub.publish(price());

    expect(socket.received.map((event) => event.sequence)).toEqual([1]);
  });

  it("keeps subscribing idempotent", () => {
    const hub = build();
    const socket = new Subscriber("u1");

    expect(hub.subscribe(socket, "market:a1")).toBe(true);
    expect(hub.subscribe(socket, "market:a1")).toBe(false);
    hub.publish(price());

    expect(socket.received).toHaveLength(1);
    expect(hub.channelsOf(socket)).toEqual(["market:a1"]);
  });

  it("stops delivering after an unsubscribe, which is idempotent too", () => {
    const hub = build();
    const socket = new Subscriber("u1");
    hub.subscribe(socket, "market:a1");

    expect(hub.unsubscribe(socket, "market:a1")).toBe(true);
    expect(hub.unsubscribe(socket, "market:a1")).toBe(false);
    hub.publish(price());

    expect(socket.received).toHaveLength(0);
    expect(hub.channelsOf(socket)).toEqual([]);
  });

  it("drops every subscription of a removed socket", () => {
    const hub = build();
    const socket = new Subscriber("u1");
    hub.subscribe(socket, "market:a1");
    hub.subscribe(socket, "portfolio:p1");

    hub.remove(socket);
    hub.publish(price());

    expect(socket.received).toHaveLength(0);
    expect(hub.channelsOf(socket)).toEqual([]);
  });

  it("delivers a notification only to the sockets of its user, with their own sequence", () => {
    const hub = build();
    const first = new Subscriber("u1");
    const firstTab = new Subscriber("u1");
    const other = new Subscriber("u2");
    hub.subscribe(first, "notifications");
    hub.subscribe(firstTab, "notifications");
    hub.subscribe(other, "notifications");

    const notification = { type: "NOTIFICATION_CREATED", channel: "notifications" } as const;
    hub.publish({ ...notification, userId: "u1", payload: {} });
    hub.publish({ ...notification, userId: "u1", payload: {} });
    hub.publish({ ...notification, userId: "u2", payload: {} });

    expect(first.received.map((event) => event.sequence)).toEqual([1, 2]);
    expect(firstTab.received.map((event) => event.sequence)).toEqual([1, 2]);
    expect(other.received.map((event) => event.sequence)).toEqual([1]);
  });

  it("drops a notification published without a user", () => {
    const hub = build();
    const socket = new Subscriber("u1");
    hub.subscribe(socket, "notifications");

    hub.publish({ type: "NOTIFICATION_CREATED", channel: "notifications", payload: {} });

    expect(socket.received).toHaveLength(0);
  });

  it("keeps delivering to the others when a socket refuses or throws", () => {
    const hub = build();
    const refusing = new Subscriber("u1", () => false);
    const throwing: HubSubscriber = {
      userId: "u2",
      send: () => {
        throw new Error("socket gone");
      },
    };
    const healthy = new Subscriber("u3");
    hub.subscribe(refusing, "market:a1");
    hub.subscribe(throwing, "market:a1");
    hub.subscribe(healthy, "market:a1");

    hub.publish(price());
    hub.publish(price());

    expect(healthy.received.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("is safe when a socket removes itself while it receives an event", () => {
    const hub = build();
    const leaving: HubSubscriber = {
      userId: "u1",
      send: () => {
        hub.remove(leaving);
        return true;
      },
    };
    const staying = new Subscriber("u2");
    hub.subscribe(leaving, "market:a1");
    hub.subscribe(staying, "market:a1");

    hub.publish(price());

    expect(staying.received).toHaveLength(1);
  });
});
