import { fixedClock } from "@trading/application";
import { REALTIME_LIMITS, realtimeEventSchema } from "@trading/contracts";
import type { RealtimeEvent } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { createWebSocketRealtimeClient } from "@/realtime/websocket-realtime-client";
import type { SocketHandlers } from "@/realtime/websocket-realtime-client";
import { createDemoRealtimeServer } from "./demo-realtime-server";

const NOW = new Date("2026-01-31T12:00:00Z");

/** Lets the microtasks of the in-process socket run, as a network round trip would. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  let next = 0;
  const server = createDemoRealtimeServer({
    clock: fixedClock(NOW),
    newId: () => `id-${String((next += 1))}`,
    epoch: "epoch-1",
  });
  const client = createWebSocketRealtimeClient({
    url: "demo://realtime",
    getAccessToken: () => "demo-token",
    createSocket: server.createSocket,
  });
  return { server, client };
}

const price = (amount: string) => ({ amount, currency: "USD" });
const marketPayload = (amount: string) => ({
  assetId: "asset1",
  price: price(amount),
  previousPrice: price("100.00"),
  change: price("1.00"),
  changePercent: 1,
  tickChange: price("0.10"),
});

async function connected() {
  const { server, client } = setup();
  client.connect();
  await flush();
  return { server, client };
}

describe("demo realtime server with the WebSocket client", () => {
  it("authenticates the client over the in-process socket", async () => {
    const { client } = setup();
    client.connect();

    expect(client.getState()).toBe("connecting");
    await flush();

    expect(client.getState()).toBe("connected");
    client.disconnect();
  });

  it("delivers a published event to a subscriber, valid against the contract and in sequence", async () => {
    const { server, client } = await connected();
    const received: RealtimeEvent[] = [];
    client.subscribe({ kind: "market", assetId: "asset1" }, (event) => received.push(event));
    await flush();

    server.publish({
      type: "MARKET_PRICE_UPDATED",
      channel: "market:asset1",
      payload: marketPayload("101.00"),
    });
    server.publish({
      type: "MARKET_PRICE_UPDATED",
      channel: "market:asset1",
      payload: marketPayload("102.00"),
    });
    await flush();

    expect(received.map((event) => event.sequence)).toEqual([1, 2]);
    expect(received.every((event) => realtimeEventSchema.safeParse(event).success)).toBe(true);
    expect(received[0]).toMatchObject({
      id: "id-1",
      epoch: "epoch-1",
      timestamp: NOW.toISOString(),
    });
    client.disconnect();
  });

  it("keeps a sequence for each channel", async () => {
    const { server, client } = await connected();
    const sequences: Record<string, number[]> = {};
    for (const assetId of ["asset1", "asset2"]) {
      client.subscribe({ kind: "market", assetId }, (event) => {
        (sequences[assetId] ??= []).push(event.sequence);
      });
    }
    await flush();

    for (const assetId of ["asset1", "asset1", "asset2"]) {
      server.publish({
        type: "MARKET_PRICE_UPDATED",
        channel: `market:${assetId}`,
        payload: { ...marketPayload("101.00"), assetId },
      });
    }
    await flush();

    expect(sequences).toEqual({ asset1: [1, 2], asset2: [1] });
    client.disconnect();
  });

  it("delivers nothing to a channel nobody subscribed to, nor after leaving it", async () => {
    const { server, client } = await connected();
    const received: RealtimeEvent[] = [];
    const leave = client.subscribe({ kind: "market", assetId: "asset1" }, (event) =>
      received.push(event),
    );
    await flush();

    server.publish({
      type: "MARKET_PRICE_UPDATED",
      channel: "market:asset2",
      payload: marketPayload("1.00"),
    });
    leave();
    await flush();
    server.publish({
      type: "MARKET_PRICE_UPDATED",
      channel: "market:asset1",
      payload: marketPayload("2.00"),
    });
    await flush();

    expect(received).toEqual([]);
    client.disconnect();
  });

  it("subscribes the channels asked for before the connection opened", async () => {
    const { server, client } = setup();
    const received: RealtimeEvent[] = [];
    client.subscribe({ kind: "notifications" }, (event) => received.push(event));
    client.connect();
    await flush();

    server.publish({
      type: "NOTIFICATION_CREATED",
      channel: "notifications",
      payload: { notificationId: "n1" },
    });
    await flush();

    expect(received).toHaveLength(1);
    client.disconnect();
  });

  it("closes the connections from the server and the client starts to reconnect", async () => {
    const { server, client } = await connected();

    server.dropConnections();
    await flush();

    expect(client.getState()).toBe("reconnecting");
    expect(server.connectionCount()).toBe(0);
    client.disconnect();
  });
});

describe("demo realtime server protocol", () => {
  function rawConnection() {
    const server = createDemoRealtimeServer({ clock: fixedClock(NOW) });
    const messages: Record<string, unknown>[] = [];
    const handlers: SocketHandlers = {
      onOpen: () => undefined,
      onMessage: (data) => messages.push(JSON.parse(data as string) as Record<string, unknown>),
      onClose: () => undefined,
    };
    const socket = server.createSocket("demo://realtime", handlers);
    const send = async (message: unknown) => {
      socket.send(typeof message === "string" ? message : JSON.stringify(message));
      await flush();
    };
    return { messages, send };
  }

  it("refuses to subscribe before authenticating", async () => {
    const { messages, send } = rawConnection();

    await send({ type: "SUBSCRIBE", channel: "market:asset1" });

    expect(messages).toEqual([expect.objectContaining({ type: "ERROR", code: "UNAUTHENTICATED" })]);
  });

  it("refuses a message that is not JSON, outside the protocol, or for a channel that does not exist", async () => {
    const { messages, send } = rawConnection();
    await send({ type: "AUTHENTICATE", accessToken: "t" });

    await send("not json");
    await send({ type: "DANCE" });
    await send({ type: "SUBSCRIBE", channel: "user:someone" });

    expect(messages.slice(1).map((message) => message.code)).toEqual([
      "INVALID_MESSAGE",
      "INVALID_MESSAGE",
      "INVALID_MESSAGE",
    ]);
  });

  it("refuses the subscription over the limit, and still accepts one it already has", async () => {
    const { messages, send } = rawConnection();
    await send({ type: "AUTHENTICATE", accessToken: "t" });
    const limit = REALTIME_LIMITS.maxSubscriptionsPerConnection;
    for (let index = 0; index < limit; index += 1) {
      await send({ type: "SUBSCRIBE", channel: `market:asset${String(index)}` });
    }

    await send({ type: "SUBSCRIBE", channel: "market:extra" });
    await send({ type: "SUBSCRIBE", channel: "market:asset0" });

    const [refused, repeated] = messages.slice(-2);
    expect(refused).toMatchObject({
      type: "ERROR",
      code: "SUBSCRIPTION_LIMIT",
      channel: "market:extra",
    });
    expect(repeated).toMatchObject({ type: "ACK", request: "SUBSCRIBE" });
  });
});
