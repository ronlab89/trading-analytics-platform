import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturingLogger } from "@trading/application";
import type { ChannelAuthorizer } from "@trading/application";
import { FakeTransport } from "./fake-transport.js";
import type { FakeSocket } from "./fake-transport.js";
import { createRealtimeGateway } from "./realtime-gateway.js";
import { createRealtimeHub } from "./realtime-hub.js";
import { createSubscriptionHandler } from "./subscription-handler.js";

const subscribe = (channel: string) => ({ type: "SUBSCRIBE", channel });
const unsubscribe = (channel: string) => ({ type: "UNSUBSCRIBE", channel });

/** u1 may see everything but `portfolio:foreign`; the `slow:` channels wait for `release`. */
function setup(options: { canSubscribe?: ChannelAuthorizer["canSubscribe"]; max?: number } = {}) {
  const transport = new FakeTransport();
  const logger = capturingLogger();
  const hub = createRealtimeHub({
    clock: { now: () => new Date() },
    newId: () => "e",
    epoch: "b1",
  });
  const canSubscribe: ChannelAuthorizer["canSubscribe"] =
    options.canSubscribe ??
    ((_actor, channel) =>
      Promise.resolve(!(channel.kind === "portfolio" && channel.portfolioId === "foreign")));
  const handler = createSubscriptionHandler({
    hub,
    authorizer: { canSubscribe },
    logger,
    ...(options.max === undefined ? {} : { maxSubscriptionsPerConnection: options.max }),
  });
  let counter = 0;
  createRealtimeGateway({
    transport,
    authenticate: (token) => ({
      userId: token,
      role: "TRADER",
      expiresAt: new Date(Date.now() + 600_000),
    }),
    clock: { now: () => new Date() },
    logger,
    newId: () => `c${(++counter).toString()}`,
    handleMessage: handler.handleMessage,
    onConnectionClosed: handler.handleConnectionClosed,
  }).start();

  function connect(userId = "u1"): FakeSocket {
    const socket = transport.connect();
    socket.receive({ type: "AUTHENTICATE", accessToken: userId });
    socket.sent.length = 0;
    return socket;
  }

  return { hub, logger, connect };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SUBSCRIBE", () => {
  it("answers ACK with the channel and delivers its events", async () => {
    const { hub, connect } = setup();
    const socket = connect();

    socket.receive(subscribe("market:a1"));
    await settle();
    hub.publish({ type: "MARKET_PRICE_UPDATED", channel: "market:a1", payload: {} });

    const [ack, event] = socket.replies();
    expect(ack).toEqual({ type: "ACK", request: "SUBSCRIBE", channel: "market:a1" });
    expect(event).toMatchObject({ type: "MARKET_PRICE_UPDATED", channel: "market:a1" });
  });

  it("is idempotent: a second SUBSCRIBE answers ACK and delivers each event once", async () => {
    const { hub, connect } = setup();
    const socket = connect();

    socket.receive(subscribe("market:a1"));
    socket.receive(subscribe("market:a1"));
    await settle();
    hub.publish({ type: "MARKET_PRICE_UPDATED", channel: "market:a1", payload: {} });

    expect(socket.replies().map((message) => (message as { type: string }).type)).toEqual([
      "ACK",
      "ACK",
      "MARKET_PRICE_UPDATED",
    ]);
  });

  it("refuses a channel the actor may not see, and delivers nothing from it", async () => {
    const { hub, connect } = setup();
    const socket = connect();

    socket.receive(subscribe("portfolio:foreign"));
    await settle();
    hub.publish({ type: "PORTFOLIO_UPDATED", channel: "portfolio:foreign", payload: {} });

    expect(socket.replies()).toEqual([
      {
        type: "ERROR",
        code: "FORBIDDEN_CHANNEL",
        message: "Channel not available.",
        channel: "portfolio:foreign",
      },
    ]);
    expect(socket.closedWith).toBeUndefined();
  });

  it("answers the same way for a channel that does not exist and one that is not theirs", async () => {
    const { connect } = setup({
      canSubscribe: () => Promise.resolve(false),
    });
    const socket = connect();

    socket.receive(subscribe("portfolio:foreign"));
    socket.receive(subscribe("portfolio:nobody"));
    await settle();

    const [foreign, missing] = socket.replies() as { code: string; message: string }[];
    expect(foreign).toMatchObject({ code: "FORBIDDEN_CHANNEL" });
    expect({ ...foreign, channel: "" }).toEqual({ ...missing, channel: "" });
  });

  it("refuses the subscription when the authorization fails, and logs it", async () => {
    const { logger, connect } = setup({
      canSubscribe: () => Promise.reject(new Error("db down")),
    });
    const socket = connect();

    socket.receive(subscribe("portfolio:p1"));
    await settle();

    expect(socket.replies()).toMatchObject([{ type: "ERROR", code: "FORBIDDEN_CHANNEL" }]);
    expect(logger.entries.some((entry) => entry.event === "realtime.message.handler_failed")).toBe(
      true,
    );
  });

  it("answers INVALID_MESSAGE for a channel name the contract does not know", async () => {
    const { connect } = setup();
    const socket = connect();

    // The gateway validates the name against the schema first, so a bad one is INVALID_MESSAGE.
    socket.receive(subscribe("user:u1"));
    await settle();

    expect(socket.replies()).toMatchObject([{ type: "ERROR", code: "INVALID_MESSAGE" }]);
  });

  it("answers SUBSCRIPTION_LIMIT and closes with 4008 beyond the cap", async () => {
    const { hub, connect } = setup({ max: 2 });
    const socket = connect();

    socket.receive(subscribe("market:a1"));
    socket.receive(subscribe("market:a2"));
    socket.receive(subscribe("market:a3"));
    await settle();

    expect(socket.replies().at(-1)).toMatchObject({
      type: "ERROR",
      code: "SUBSCRIPTION_LIMIT",
      channel: "market:a3",
    });
    expect(socket.closedWith?.code).toBe(4008);
    expect(hub.channelsOf({ userId: "u1", send: () => true })).toEqual([]);
  });

  it("does not count an idempotent repeat toward the cap", async () => {
    const { connect } = setup({ max: 2 });
    const socket = connect();

    socket.receive(subscribe("market:a1"));
    socket.receive(subscribe("market:a1"));
    socket.receive(subscribe("market:a2"));
    await settle();

    expect(socket.closedWith).toBeUndefined();
  });

  it("subscribes nothing when the socket closes while the authorization runs", async () => {
    let release: () => void = () => undefined;
    const { hub, connect } = setup({
      canSubscribe: () =>
        new Promise<boolean>((resolve) => {
          release = () => {
            resolve(true);
          };
        }),
    });
    const socket = connect();

    socket.receive(subscribe("market:a1"));
    await settle();
    socket.close(1000, "bye");
    release();
    await settle();
    hub.publish({ type: "MARKET_PRICE_UPDATED", channel: "market:a1", payload: {} });

    expect(socket.replies()).toEqual([]);
  });
});

describe("UNSUBSCRIBE", () => {
  it("answers ACK and stops the events, and is idempotent", async () => {
    const { hub, connect } = setup();
    const socket = connect();
    socket.receive(subscribe("market:a1"));
    await settle();
    socket.sent.length = 0;

    socket.receive(unsubscribe("market:a1"));
    socket.receive(unsubscribe("market:a1"));
    await settle();
    hub.publish({ type: "MARKET_PRICE_UPDATED", channel: "market:a1", payload: {} });

    expect(socket.replies()).toEqual([
      { type: "ACK", request: "UNSUBSCRIBE", channel: "market:a1" },
      { type: "ACK", request: "UNSUBSCRIBE", channel: "market:a1" },
    ]);
  });

  it("answers ACK for a channel that was never subscribed", async () => {
    const { connect } = setup();
    const socket = connect();

    socket.receive(unsubscribe("market:a1"));
    await settle();

    expect(socket.replies()).toEqual([
      { type: "ACK", request: "UNSUBSCRIBE", channel: "market:a1" },
    ]);
  });
});

describe("ordering and cleanup", () => {
  it("applies the messages of a connection in arrival order, even when authorization is slow", async () => {
    let release: () => void = () => undefined;
    const { hub, connect } = setup({
      canSubscribe: () =>
        new Promise<boolean>((resolve) => {
          release = () => {
            resolve(true);
          };
        }),
    });
    const socket = connect();

    socket.receive(subscribe("market:a1"));
    socket.receive(unsubscribe("market:a1"));
    await settle();
    release();
    await settle();
    socket.sent.length = 0;
    hub.publish({ type: "MARKET_PRICE_UPDATED", channel: "market:a1", payload: {} });

    expect(socket.replies()).toEqual([]);
  });

  it("drops the subscriptions of a connection when it closes", async () => {
    const { hub, connect } = setup();
    const socket = connect();
    socket.receive(subscribe("market:a1"));
    await settle();
    socket.sent.length = 0;

    socket.close(1000, "bye");
    hub.publish({ type: "MARKET_PRICE_UPDATED", channel: "market:a1", payload: {} });

    expect(socket.replies()).toEqual([]);
  });

  it("delivers an event to the sockets that subscribed and to no one else", async () => {
    const { hub, connect } = setup();
    const subscribed = connect("u1");
    const other = connect("u2");
    subscribed.receive(subscribe("market:a1"));
    await settle();
    subscribed.sent.length = 0;

    hub.publish({ type: "MARKET_PRICE_UPDATED", channel: "market:a1", payload: {} });

    expect(subscribed.replies()).toHaveLength(1);
    expect(other.replies()).toHaveLength(0);
  });
});
