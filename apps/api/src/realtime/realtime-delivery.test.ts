import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { capturingLogger } from "@trading/application";
import { REALTIME_LIMITS } from "@trading/contracts";
import { Money, UserRole } from "@trading/domain";
import { systemClock } from "../clock.js";
import { createTokenService } from "../services/token.service.js";
import { createAccessTokenAuthenticator } from "./access-token-authenticator.js";
import { createHubRealtimePublisher } from "./hub-realtime-publisher.js";
import { createRealtimeGateway } from "./realtime-gateway.js";
import type { RealtimeGateway, RealtimeLimits } from "./realtime-gateway.js";
import { createRealtimeHub } from "./realtime-hub.js";
import { createSubscriptionHandler } from "./subscription-handler.js";
import { REALTIME_PATH, createWsTransport } from "./ws-transport.js";

/**
 * The whole delivery path over real sockets: client, gateway, subscription
 * handler, hub and the publisher the services will call.
 */

const tokens = createTokenService({
  secret: "integration-test-secret-integration-test-secret",
  ttlSeconds: 900,
  clock: systemClock,
});

interface Running {
  server: Server;
  gateway: RealtimeGateway;
  url: string;
  publisher: ReturnType<typeof createHubRealtimePublisher>;
}

/** A client that keeps every message it receives, in order. */
interface Client {
  socket: WebSocket;
  messages: Record<string, unknown>[];
  send: (message: unknown) => void;
  waitFor: (count: number) => Promise<void>;
  closed: Promise<number>;
}

const running: Running[] = [];
const sockets: WebSocket[] = [];

async function start(limits: Partial<RealtimeLimits> = {}): Promise<Running> {
  const transport = createWsTransport({
    path: REALTIME_PATH,
    maxPayloadBytes: REALTIME_LIMITS.maxInboundPayloadBytes,
    closeGraceMs: 500,
  });
  const logger = capturingLogger();
  const hub = createRealtimeHub({
    clock: systemClock,
    newId: () => crypto.randomUUID(),
    epoch: "e1",
  });
  const handler = createSubscriptionHandler({
    hub,
    // A user owns only the portfolio `p-<userId>`.
    authorizer: {
      canSubscribe: (actor, channel) =>
        Promise.resolve(
          channel.kind !== "portfolio" || channel.portfolioId === `p-${actor.userId}`,
        ),
    },
    logger,
  });
  const gateway = createRealtimeGateway({
    transport,
    authenticate: createAccessTokenAuthenticator(tokens),
    clock: systemClock,
    logger,
    newId: () => crypto.randomUUID(),
    handleMessage: handler.handleMessage,
    onReauthenticated: handler.handleReauthenticated,
    onConnectionClosed: handler.handleConnectionClosed,
    limits,
  });
  gateway.start();

  const server = createServer((_request, response) => {
    response.statusCode = 404;
    response.end();
  });
  transport.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const instance = {
    server,
    gateway,
    publisher: createHubRealtimePublisher(hub),
    url: `ws://127.0.0.1:${(server.address() as AddressInfo).port.toString()}${REALTIME_PATH}`,
  };
  running.push(instance);
  return instance;
}

async function connect(url: string, userId: string): Promise<Client> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages: Record<string, unknown>[] = [];
  const waiters: { count: number; resolve: () => void }[] = [];

  socket.on("message", (data) => {
    messages.push(JSON.parse((data as Buffer).toString("utf8")) as Record<string, unknown>);
    for (const waiter of waiters) {
      if (messages.length >= waiter.count) {
        waiter.resolve();
      }
    }
  });
  const closed = new Promise<number>((resolve) => socket.once("close", resolve));
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => {
      resolve();
    });
    socket.once("error", reject);
  });

  const client: Client = {
    socket,
    messages,
    closed,
    send: (message) => {
      socket.send(JSON.stringify(message));
    },
    waitFor: (count) =>
      messages.length >= count
        ? Promise.resolve()
        : new Promise((resolve) => {
            waiters.push({ count, resolve });
          }),
  };

  client.send({
    type: "AUTHENTICATE",
    accessToken: tokens.issue({ userId, role: UserRole.TRADER }).accessToken,
  });
  await client.waitFor(1);
  return client;
}

const usd = (amount: string) => Money.of(amount, "USD");
const tick = (assetId: string, price: string) => ({
  assetId,
  price: usd(price),
  previousPrice: usd("100"),
  change: usd("1"),
  changePercent: 1,
  tickChange: usd("0.1"),
});

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  for (const instance of running.splice(0)) {
    await instance.gateway.stop();
    instance.server.closeAllConnections();
    await new Promise((resolve) => instance.server.close(resolve));
  }
});

describe("delivery over real sockets", () => {
  it("delivers a published price to the subscriber, in order, with sequence and epoch", async () => {
    const { url, publisher } = await start();
    const client = await connect(url, "u1");

    client.send({ type: "SUBSCRIBE", channel: "market:a1" });
    await client.waitFor(2);
    await publisher.marketPriceUpdated(tick("a1", "101"));
    await publisher.marketPriceUpdated(tick("a1", "102"));
    await client.waitFor(4);

    expect(client.messages[1]).toEqual({ type: "ACK", request: "SUBSCRIBE", channel: "market:a1" });
    expect(client.messages.slice(2).map((m) => [m.type, m.channel, m.sequence, m.epoch])).toEqual([
      ["MARKET_PRICE_UPDATED", "market:a1", 1, "e1"],
      ["MARKET_PRICE_UPDATED", "market:a1", 2, "e1"],
    ]);
  });

  it("delivers an event only to the sockets subscribed to its channel", async () => {
    const { url, publisher } = await start();
    const watcher = await connect(url, "u1");
    const bystander = await connect(url, "u2");

    watcher.send({ type: "SUBSCRIBE", channel: "market:a1" });
    bystander.send({ type: "SUBSCRIBE", channel: "market:a2" });
    await watcher.waitFor(2);
    await bystander.waitFor(2);
    await publisher.marketPriceUpdated(tick("a1", "101"));
    await watcher.waitFor(3);

    expect(bystander.messages).toHaveLength(2);
  });

  it("refuses another user's portfolio with the same error as an unknown one", async () => {
    const { url, publisher } = await start();
    const client = await connect(url, "u1");

    client.send({ type: "SUBSCRIBE", channel: "portfolio:p-u2" });
    client.send({ type: "SUBSCRIBE", channel: "portfolio:p-nobody" });
    await client.waitFor(3);
    await publisher.portfolioUpdated("p-u2", "TRANSACTION_COMMITTED");

    const [, foreign, missing] = client.messages;
    expect(foreign).toMatchObject({ type: "ERROR", code: "FORBIDDEN_CHANNEL" });
    expect({ ...foreign, channel: "" }).toEqual({ ...missing, channel: "" });
    expect(client.messages).toHaveLength(3);
  });

  it("delivers a repeated SUBSCRIBE once, and nothing after UNSUBSCRIBE", async () => {
    const { url, publisher } = await start();
    const client = await connect(url, "u1");

    client.send({ type: "SUBSCRIBE", channel: "market:a1" });
    client.send({ type: "SUBSCRIBE", channel: "market:a1" });
    await client.waitFor(3);
    await publisher.marketPriceUpdated(tick("a1", "101"));
    await client.waitFor(4);
    client.send({ type: "UNSUBSCRIBE", channel: "market:a1" });
    await client.waitFor(5);
    await publisher.marketPriceUpdated(tick("a1", "102"));
    client.send({ type: "UNSUBSCRIBE", channel: "market:a1" });
    await client.waitFor(6);

    expect(client.messages.map((m) => m.type)).toEqual([
      "ACK",
      "ACK",
      "ACK",
      "MARKET_PRICE_UPDATED",
      "ACK",
      "ACK",
    ]);
  });

  it("closes with 4008 on the 51st subscription", async () => {
    // The burst must reach the subscription cap before the inbound rate limit.
    const { url } = await start({ maxInboundMessagesPerSecond: 1000 });
    const client = await connect(url, "u1");

    for (let index = 0; index <= REALTIME_LIMITS.maxSubscriptionsPerConnection; index += 1) {
      client.send({ type: "SUBSCRIBE", channel: `market:a${index.toString()}` });
    }

    expect(await client.closed).toBe(4008);
    expect(client.messages.at(-1)).toMatchObject({ type: "ERROR", code: "SUBSCRIPTION_LIMIT" });
  });

  it("sends a notification only to the sockets of its user", async () => {
    const { url, publisher } = await start();
    const owner = await connect(url, "u1");
    const other = await connect(url, "u2");

    owner.send({ type: "SUBSCRIBE", channel: "notifications" });
    other.send({ type: "SUBSCRIBE", channel: "notifications" });
    await owner.waitFor(2);
    await other.waitFor(2);
    await publisher.notificationCreated({ id: "n1", userId: "u1" } as never);
    await owner.waitFor(3);

    expect(owner.messages[2]).toMatchObject({ type: "NOTIFICATION_CREATED", sequence: 1 });
    expect(other.messages).toHaveLength(2);
  });
});
