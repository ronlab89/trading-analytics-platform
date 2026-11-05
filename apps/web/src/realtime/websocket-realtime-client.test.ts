import { jobsChannelName, marketChannelName, type RealtimeEvent } from "@trading/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWebSocketRealtimeClient,
  type CreateSocket,
  type SocketHandlers,
} from "./websocket-realtime-client";

const URL_OF_THE_SERVER = "ws://localhost:7001/ws";
const usd = (amount: string) => ({ amount, currency: "USD" });

interface FakeSocket {
  url: string;
  handlers: SocketHandlers;
  sent: unknown[];
  closedWith: number | undefined;
  send: (data: string) => void;
  close: (code?: number) => void;
}

function setup(initialToken: string | null = "access-token") {
  let token = initialToken;
  const sockets: FakeSocket[] = [];
  const createSocket: CreateSocket = (url, handlers) => {
    const socket: FakeSocket = {
      url,
      handlers,
      sent: [],
      closedWith: undefined,
      send: (data) => {
        socket.sent.push(JSON.parse(data));
      },
      close: (code) => {
        socket.closedWith = code ?? 1000;
      },
    };
    sockets.push(socket);
    return socket;
  };
  const warn = vi.fn();
  const client = createWebSocketRealtimeClient({
    url: URL_OF_THE_SERVER,
    getAccessToken: () => token ?? undefined,
    createSocket,
    logger: { warn },
    random: () => 0,
  });
  const endSession = () => {
    token = null;
  };
  return { client, sockets, warn, endSession };
}

function socketAt(sockets: FakeSocket[], index: number): FakeSocket {
  const socket = sockets[index];
  if (socket === undefined) throw new Error(`No socket ${String(index)} was opened`);
  return socket;
}

function socketOf(socket: FakeSocket | undefined): FakeSocket {
  if (socket === undefined) throw new Error("No socket was opened");
  return socket;
}

/** The server accepting the connection and the token, as it does in a healthy start. */
function open(socket: FakeSocket) {
  socket.handlers.onOpen();
  socket.handlers.onMessage(JSON.stringify({ type: "ACK", request: "AUTHENTICATE" }));
}

function receive(socket: FakeSocket, message: unknown) {
  socket.handlers.onMessage(JSON.stringify(message));
}

function priceEvent(assetId: string, sequence = 1): RealtimeEvent {
  return {
    id: `e${String(sequence)}`,
    type: "MARKET_PRICE_UPDATED",
    channel: marketChannelName(assetId),
    sequence,
    timestamp: "2026-11-04T14:30:00.000Z",
    epoch: "epoch-1",
    payload: {
      assetId,
      price: usd("181.20"),
      previousPrice: usd("176.60"),
      change: usd("4.60"),
      changePercent: 2.6,
      tickChange: usd("0.10"),
    },
  };
}

describe("connect", () => {
  it("opens one socket on the address it was given, and is connecting until the server accepts the token", () => {
    const { client, sockets } = setup();

    client.connect();

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.url).toBe(URL_OF_THE_SERVER);
    expect(client.getState()).toBe("connecting");
  });

  it("authenticates with the token in the first message, never in the address", () => {
    const { client, sockets } = setup("secret-token");
    client.connect();
    const [socket] = sockets;

    socket?.handlers.onOpen();

    expect(socket?.sent).toEqual([{ type: "AUTHENTICATE", accessToken: "secret-token" }]);
    expect(socket?.url).not.toContain("secret-token");
    expect(client.getState()).toBe("connecting");
  });

  it("is connected once the server acknowledges the authentication", () => {
    const { client, sockets } = setup();
    client.connect();

    open(socketAt(sockets, 0));

    expect(client.getState()).toBe("connected");
  });

  it("opens nothing again while it is already open or opening", () => {
    const { client, sockets } = setup();

    client.connect();
    client.connect();
    open(socketAt(sockets, 0));
    client.connect();

    expect(sockets).toHaveLength(1);
  });

  it("does not connect when there is no session to authenticate", () => {
    const { client, sockets } = setup(null);

    client.connect();

    expect(sockets).toHaveLength(0);
    expect(client.getState()).toBe("disconnected");
  });

  it("tells the state listeners about every change, and stops when they leave", () => {
    const { client, sockets } = setup();
    const listener = vi.fn();
    const leave = client.onStateChange(listener);

    client.connect();
    expect(listener).toHaveBeenCalledTimes(1);
    open(socketAt(sockets, 0));
    expect(listener).toHaveBeenCalledTimes(2);

    leave();
    client.disconnect();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("subscribe", () => {
  it("asks for the channel once the connection is authenticated, once however many listen", () => {
    const { client, sockets } = setup();
    client.subscribe({ kind: "market", assetId: "a1" }, vi.fn());
    client.subscribe({ kind: "market", assetId: "a1" }, vi.fn());
    client.connect();
    const [socket] = sockets;

    socket?.handlers.onOpen();
    expect(socket?.sent).toHaveLength(1);
    receive(socketOf(socket), { type: "ACK", request: "AUTHENTICATE" });

    expect(socket?.sent.slice(1)).toEqual([{ type: "SUBSCRIBE", channel: "market:a1" }]);
  });

  it("asks for the channel at once when it is already connected", () => {
    const { client, sockets } = setup();
    client.connect();
    open(socketAt(sockets, 0));

    client.subscribe({ kind: "notifications" }, vi.fn());

    expect(sockets[0]?.sent.at(-1)).toEqual({ type: "SUBSCRIBE", channel: "notifications" });
  });

  it("shares one subscription and leaves the channel when the last listener goes", () => {
    const { client, sockets } = setup();
    client.connect();
    const [socket] = sockets;
    open(socketOf(socket));
    const first = client.subscribe({ kind: "portfolio", portfolioId: "p1" }, vi.fn());
    const second = client.subscribe({ kind: "portfolio", portfolioId: "p1" }, vi.fn());
    const messages = () => socket?.sent.slice(1);
    expect(messages()).toEqual([{ type: "SUBSCRIBE", channel: "portfolio:p1" }]);

    first();
    expect(messages()).toHaveLength(1);
    second();
    expect(messages()?.at(-1)).toEqual({ type: "UNSUBSCRIBE", channel: "portfolio:p1" });
    second();
    expect(messages()).toHaveLength(2);
  });

  it("does not ask for a channel that all its listeners left before the connection was ready", () => {
    const { client, sockets } = setup();
    const leave = client.subscribe({ kind: "market", assetId: "a1" }, vi.fn());
    client.connect();
    leave();

    open(socketAt(sockets, 0));

    expect(sockets[0]?.sent).toEqual([{ type: "AUTHENTICATE", accessToken: "access-token" }]);
  });
});

describe("events", () => {
  it("gives an event to the listeners of its channel only", () => {
    const { client, sockets } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    const onApple = vi.fn();
    const onMicrosoft = vi.fn();
    client.subscribe({ kind: "market", assetId: "a1" }, onApple);
    client.subscribe({ kind: "market", assetId: "a2" }, onMicrosoft);

    receive(socketAt(sockets, 0), priceEvent("a1"));

    expect(onApple).toHaveBeenCalledWith(priceEvent("a1"));
    expect(onMicrosoft).not.toHaveBeenCalled();
  });

  it("stops giving events to a listener that left", () => {
    const { client, sockets } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    const listener = vi.fn();
    const leave = client.subscribe({ kind: "market", assetId: "a1" }, listener);
    leave();

    receive(socketAt(sockets, 0), priceEvent("a1"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("drops what is not a valid event or not even JSON, and says so, without breaking the rest", () => {
    const { client, sockets, warn } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    const listener = vi.fn();
    client.subscribe({ kind: "market", assetId: "a1" }, listener);
    const socket = socketAt(sockets, 0);

    socket.handlers.onMessage("not json");
    receive(socket, { type: "SOMETHING_NEW", channel: "market:a1" });
    receive(socket, { ...priceEvent("a1"), payload: { assetId: "a1" } });
    receive(socket, priceEvent("a1", 2));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls.every(([event]) => event === "realtime.message.dropped")).toBe(true);
  });

  it("does not let a listener that throws stop the others", () => {
    const { client, sockets, warn } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    const after = vi.fn();
    client.subscribe({ kind: "jobs", jobId: "j1" }, () => {
      throw new Error("boom");
    });
    client.subscribe({ kind: "jobs", jobId: "j1" }, after);

    receive(socketAt(sockets, 0), {
      id: "e1",
      type: "JOB_COMPLETED",
      channel: jobsChannelName("j1"),
      sequence: 1,
      timestamp: "2026-11-04T14:30:00.000Z",
      epoch: "epoch-1",
      payload: { jobId: "j1", status: "COMPLETED" },
    });

    expect(after).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("realtime.listener.failed", expect.anything());
  });
});

describe("disconnect", () => {
  it("closes the socket on purpose, leaves the state disconnected and hears nothing more", () => {
    const { client, sockets } = setup();
    client.connect();
    const [socket] = sockets;
    open(socketOf(socket));
    const listener = vi.fn();
    client.subscribe({ kind: "market", assetId: "a1" }, listener);

    client.disconnect();
    receive(socketOf(socket), priceEvent("a1"));
    socket?.handlers.onClose(1000);

    expect(socket?.closedWith).toBe(1000);
    expect(client.getState()).toBe("disconnected");
    expect(listener).not.toHaveBeenCalled();
  });

  it("can connect again afterwards, on a new socket, asking again for what is subscribed", () => {
    const { client, sockets } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    client.subscribe({ kind: "notifications" }, vi.fn());
    client.disconnect();

    client.connect();
    open(socketAt(sockets, 1));

    expect(sockets).toHaveLength(2);
    expect(sockets[1]?.sent).toEqual([
      { type: "AUTHENTICATE", accessToken: "access-token" },
      { type: "SUBSCRIBE", channel: "notifications" },
    ]);
  });
});

describe("reconnection after an unexpected close", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is reconnecting at once and opens a new socket only after the delay", () => {
    const { client, sockets } = setup();
    client.connect();
    open(socketAt(sockets, 0));

    socketAt(sockets, 0).handlers.onClose(1006);

    expect(client.getState()).toBe("reconnecting");
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    expect(client.getState()).toBe("reconnecting");
  });

  it("authenticates again and asks once for each channel when the new connection is accepted", () => {
    const { client, sockets } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    client.subscribe({ kind: "market", assetId: "a1" }, vi.fn());
    client.subscribe({ kind: "market", assetId: "a1" }, vi.fn());
    client.subscribe({ kind: "notifications" }, vi.fn());
    socketAt(sockets, 0).handlers.onClose(1006);
    vi.advanceTimersByTime(1_000);

    open(socketAt(sockets, 1));

    expect(client.getState()).toBe("connected");
    expect(sockets[1]?.sent).toEqual([
      { type: "AUTHENTICATE", accessToken: "access-token" },
      { type: "SUBSCRIBE", channel: "market:a1" },
      { type: "SUBSCRIBE", channel: "notifications" },
    ]);
  });

  it("waits longer after each failed attempt and starts again from 1 s once it is connected", () => {
    const { client, sockets } = setup();
    client.connect();
    socketAt(sockets, 0).handlers.onClose(1006);
    vi.advanceTimersByTime(1_000);
    socketAt(sockets, 1).handlers.onClose(1006);
    vi.advanceTimersByTime(1_999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);

    open(socketAt(sockets, 2));
    socketAt(sockets, 2).handlers.onClose(1006);
    vi.advanceTimersByTime(1_000);

    expect(sockets).toHaveLength(4);
  });

  it("does not reconnect after a close on purpose, and cancels a reconnection that was waiting", () => {
    const { client, sockets } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    socketAt(sockets, 0).handlers.onClose(1006);

    client.disconnect();
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(1);
    expect(client.getState()).toBe("disconnected");
  });

  it("gives up quietly when the session ended while it waited", () => {
    const { client, sockets, endSession } = setup();
    client.connect();
    open(socketAt(sockets, 0));
    socketAt(sockets, 0).handlers.onClose(1006);

    endSession();
    vi.advanceTimersByTime(1_000);

    expect(sockets).toHaveLength(1);
    expect(client.getState()).toBe("disconnected");
  });

  it("does not hear a socket it already left", () => {
    const { client, sockets } = setup();
    client.connect();
    socketAt(sockets, 0).handlers.onClose(1006);
    vi.advanceTimersByTime(1_000);

    socketAt(sockets, 0).handlers.onClose(1006);
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(2);
  });
});
