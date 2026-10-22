import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturingLogger } from "@trading/application";
import { REALTIME_CLOSE_CODES, REALTIME_LIMITS } from "@trading/contracts";
import type { ClientMessage } from "@trading/contracts";
import type { RealtimeAuthenticator } from "./access-token-authenticator.js";
import { FakeTransport } from "./fake-transport.js";
import type { FakeSocket } from "./fake-transport.js";
import { createRealtimeGateway } from "./realtime-gateway.js";
import type { RealtimeConnection, RealtimeGatewayOptions } from "./realtime-gateway.js";

/** A token `userId:seconds` is valid for that many seconds; anything else is invalid. */
const authenticate: RealtimeAuthenticator = (token) => {
  const [userId, seconds] = token.split(":");
  if (!userId || !seconds) {
    throw new Error("invalid token");
  }
  return { userId, role: "TRADER", expiresAt: new Date(Date.now() + Number(seconds) * 1000) };
};

const authMessage = (token: string) => ({ type: "AUTHENTICATE", accessToken: token });

function setup(overrides: Partial<RealtimeGatewayOptions> = {}) {
  const transport = new FakeTransport();
  const logger = capturingLogger();
  let sequence = 0;
  const gateway = createRealtimeGateway({
    transport,
    authenticate,
    clock: { now: () => new Date() },
    logger,
    newId: () => `connection-${(++sequence).toString()}`,
    ...overrides,
  });
  gateway.start();

  function authenticated(token = "u1:600"): FakeSocket {
    const socket = transport.connect();
    socket.receive(authMessage(token));
    return socket;
  }

  return { transport, logger, gateway, authenticated };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("authentication", () => {
  it("answers ACK to a valid first message and keeps the socket open", () => {
    const { authenticated } = setup();

    const socket = authenticated();

    expect(socket.replies()).toEqual([{ type: "ACK", request: "AUTHENTICATE" }]);
    expect(socket.closedWith).toBeUndefined();
  });

  it("closes with 4001 and an INVALID_TOKEN error for an invalid token", () => {
    const { authenticated } = setup();

    const socket = authenticated("garbage");

    expect(socket.replies()).toEqual([
      { type: "ERROR", code: "INVALID_TOKEN", message: "Invalid access token." },
    ]);
    expect(socket.closedWith?.code).toBe(REALTIME_CLOSE_CODES.UNAUTHENTICATED);
  });

  it("closes with 4001 when the first message is anything but AUTHENTICATE", () => {
    const { transport } = setup();
    const socket = transport.connect();

    socket.receive({ type: "SUBSCRIBE", channel: "notifications" });

    expect(socket.replies()).toMatchObject([{ type: "ERROR", code: "UNAUTHENTICATED" }]);
    expect(socket.closedWith?.code).toBe(4001);
  });

  it("closes with 4001 when the first message is not valid JSON", () => {
    const { transport } = setup();
    const socket = transport.connect();

    socket.receive("{not json");

    expect(socket.replies()).toMatchObject([{ type: "ERROR", code: "INVALID_MESSAGE" }]);
    expect(socket.closedWith?.code).toBe(4001);
  });

  it("closes with 4001 when no AUTHENTICATE arrives within 5 seconds", () => {
    const { transport } = setup();
    const socket = transport.connect();

    vi.advanceTimersByTime(REALTIME_LIMITS.authenticationTimeoutMs - 1);
    expect(socket.closedWith).toBeUndefined();
    vi.advanceTimersByTime(1);

    expect(socket.closedWith?.code).toBe(4001);
  });

  it("does not close an authenticated socket when the 5 seconds pass", () => {
    const { authenticated } = setup();
    const socket = authenticated();

    vi.advanceTimersByTime(REALTIME_LIMITS.authenticationTimeoutMs + 1);

    expect(socket.closedWith).toBeUndefined();
  });
});

describe("token expiry and re-authentication", () => {
  it("closes with 4002 when the token expires", () => {
    const { authenticated } = setup();
    const socket = authenticated("u1:10");

    vi.advanceTimersByTime(9_999);
    expect(socket.closedWith).toBeUndefined();
    vi.advanceTimersByTime(1);

    expect(socket.closedWith?.code).toBe(REALTIME_CLOSE_CODES.TOKEN_EXPIRED);
  });

  it("extends the bound when the same user authenticates again", () => {
    const { authenticated } = setup();
    const socket = authenticated("u1:10");
    vi.advanceTimersByTime(5_000);

    socket.receive(authMessage("u1:30"));
    vi.advanceTimersByTime(10_000);

    expect(socket.closedWith).toBeUndefined();
    expect(socket.replies()).toHaveLength(2);
    vi.advanceTimersByTime(20_000);
    expect(socket.closedWith?.code).toBe(4002);
  });

  it("closes with 4001 when the new token belongs to another user", () => {
    const { authenticated } = setup();
    const socket = authenticated("u1:600");

    socket.receive(authMessage("u2:600"));

    expect(socket.replies().at(-1)).toMatchObject({ type: "ERROR", code: "INVALID_TOKEN" });
    expect(socket.closedWith?.code).toBe(4001);
  });

  it("closes with 4001 when the new token is invalid", () => {
    const { authenticated } = setup();
    const socket = authenticated("u1:600");

    socket.receive(authMessage("garbage"));

    expect(socket.closedWith?.code).toBe(4001);
  });
});

describe("inbound limits", () => {
  it("accepts 20 messages in a second and closes with 4008 at the 21st", () => {
    const { authenticated } = setup();
    const socket = authenticated();
    // The AUTHENTICATE message was the first one of the window.
    for (let count = 1; count < REALTIME_LIMITS.maxInboundMessagesPerSecond; count += 1) {
      socket.receive("{}");
    }
    expect(socket.closedWith).toBeUndefined();

    socket.receive("{}");

    expect(socket.closedWith?.code).toBe(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED);
  });

  it("starts a new window each second", () => {
    const { authenticated } = setup();
    const socket = authenticated();
    for (let count = 1; count < REALTIME_LIMITS.maxInboundMessagesPerSecond; count += 1) {
      socket.receive("{}");
    }

    vi.advanceTimersByTime(1000);
    socket.receive("{}");

    expect(socket.closedWith).toBeUndefined();
  });

  it("answers INVALID_MESSAGE and stays open for a bad message after authentication", () => {
    const { authenticated } = setup();
    const socket = authenticated();

    socket.receive("{not json");
    socket.receive({ type: "PING" });

    expect(socket.replies().slice(1)).toMatchObject([
      { type: "ERROR", code: "INVALID_MESSAGE" },
      { type: "ERROR", code: "INVALID_MESSAGE" },
    ]);
    expect(socket.closedWith).toBeUndefined();
  });
});

describe("heartbeat", () => {
  const interval = REALTIME_LIMITS.heartbeatIntervalMs;

  it("pings every 30 seconds", () => {
    const { authenticated } = setup();
    const socket = authenticated("u1:100000");

    vi.advanceTimersByTime(interval);
    expect(socket.pings).toBe(1);
    vi.advanceTimersByTime(interval);
    expect(socket.pings).toBe(2);
  });

  it("closes with 4008 after two missed pongs", () => {
    const { authenticated } = setup();
    const socket = authenticated("u1:100000");

    vi.advanceTimersByTime(interval * 2);
    expect(socket.closedWith).toBeUndefined();
    vi.advanceTimersByTime(interval);

    expect(socket.closedWith?.code).toBe(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED);
  });

  it("stays open while the client answers every ping", () => {
    const { authenticated } = setup();
    const socket = authenticated("u1:100000");

    for (let tick = 0; tick < 5; tick += 1) {
      vi.advanceTimersByTime(interval);
      socket.pong();
    }

    expect(socket.closedWith).toBeUndefined();
  });
});

describe("outbound buffer", () => {
  it("closes with 4008 instead of sending past 1 MB", async () => {
    let connection: RealtimeConnection | undefined;
    const { authenticated } = setup({
      handleMessage: (current) => {
        connection = current;
      },
    });
    const socket = authenticated();
    socket.receive({ type: "SUBSCRIBE", channel: "notifications" });
    await vi.advanceTimersByTimeAsync(0);
    socket.bufferedAmount = REALTIME_LIMITS.maxOutboundBufferBytes;

    const sent = connection?.send({ type: "ACK", request: "SUBSCRIBE" });

    expect(sent).toBe(false);
    expect(socket.closedWith?.code).toBe(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED);
    expect(socket.sent).toHaveLength(1);
  });

  it("sends while the buffer is under the limit", async () => {
    let connection: RealtimeConnection | undefined;
    const { authenticated } = setup({
      handleMessage: (current) => {
        connection = current;
      },
    });
    const socket = authenticated();
    socket.receive({ type: "SUBSCRIBE", channel: "notifications" });
    await vi.advanceTimersByTimeAsync(0);

    expect(connection?.send({ hello: "world" })).toBe(true);
    expect(socket.replies().at(-1)).toEqual({ hello: "world" });
  });
});

describe("connections per user", () => {
  it("closes the sixth connection of a user with 4008 and keeps the five open", () => {
    const { authenticated } = setup();
    const first = Array.from({ length: REALTIME_LIMITS.maxConnectionsPerUser }, () =>
      authenticated(),
    );

    const excess = authenticated();

    expect(excess.closedWith?.code).toBe(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED);
    expect(first.every((socket) => socket.closedWith === undefined)).toBe(true);
  });

  it("does not count the connections of other users", () => {
    const { authenticated } = setup();
    for (let count = 0; count < REALTIME_LIMITS.maxConnectionsPerUser; count += 1) {
      authenticated("u1:600");
    }

    expect(authenticated("u2:600").closedWith).toBeUndefined();
  });

  it("frees a slot when a connection closes", () => {
    const { authenticated } = setup();
    const sockets = Array.from({ length: REALTIME_LIMITS.maxConnectionsPerUser }, () =>
      authenticated(),
    );

    sockets[0]?.close(1000, "bye");

    expect(authenticated().closedWith).toBeUndefined();
  });

  it("does not count a connection that has not authenticated", () => {
    const { authenticated, transport } = setup();
    for (let count = 0; count < 10; count += 1) {
      transport.connect();
    }

    expect(authenticated().closedWith).toBeUndefined();
  });

  it("does not count a re-authentication as a new connection", () => {
    const { authenticated } = setup();
    const sockets = Array.from({ length: REALTIME_LIMITS.maxConnectionsPerUser }, () =>
      authenticated(),
    );

    sockets[0]?.receive(authMessage("u1:900"));

    expect(sockets[0]?.closedWith).toBeUndefined();
  });
});

describe("messages of an authenticated connection", () => {
  it("hands them to the handler with the connection", async () => {
    const received: [string, ClientMessage][] = [];
    const { authenticated } = setup({
      handleMessage: (connection, message) => {
        received.push([connection.userId, message]);
      },
    });
    const socket = authenticated("u7:600");

    socket.receive({ type: "SUBSCRIBE", channel: "jobs:j1" });
    await vi.advanceTimersByTimeAsync(0);

    expect(received).toEqual([["u7", { type: "SUBSCRIBE", channel: "jobs:j1" }]]);
  });

  it("answers INVALID_MESSAGE while no handler is installed", () => {
    const { authenticated } = setup();
    const socket = authenticated();

    socket.receive({ type: "SUBSCRIBE", channel: "jobs:j1" });

    expect(socket.replies().at(-1)).toMatchObject({ type: "ERROR", code: "INVALID_MESSAGE" });
  });
});

describe("shutdown", () => {
  it("closes every socket with 1001, authenticated or not, and closes the transport", async () => {
    const { authenticated, transport, gateway } = setup();
    const authenticatedSocket = authenticated();
    const anonymousSocket = transport.connect();

    await gateway.stop();

    expect(authenticatedSocket.closedWith?.code).toBe(REALTIME_CLOSE_CODES.GOING_AWAY);
    expect(anonymousSocket.closedWith?.code).toBe(REALTIME_CLOSE_CODES.GOING_AWAY);
    expect(transport.closedWith?.code).toBe(REALTIME_CLOSE_CODES.GOING_AWAY);
  });

  it("closes a connection that arrives while stopping", async () => {
    const { transport, gateway } = setup();
    await gateway.stop();

    const late = transport.connect();

    expect(late.closedWith?.code).toBe(1001);
  });
});

describe("logging", () => {
  it("logs the connection id on every event and the user id once it is known", () => {
    const { authenticated, logger } = setup();

    const socket = authenticated("u9:600");
    socket.close(1000, "bye");

    expect(logger.entries.map((entry) => [entry.event, entry.fields])).toEqual([
      ["realtime.connection.opened", { connectionId: "connection-1" }],
      ["realtime.connection.authenticated", { connectionId: "connection-1", userId: "u9" }],
      [
        "realtime.connection.closed",
        expect.objectContaining({ connectionId: "connection-1", userId: "u9", code: 1000 }),
      ],
    ]);
  });

  it("never logs the access token", () => {
    const { authenticated, logger } = setup();

    authenticated("u9:600");
    authenticated("secret-token-that-is-invalid");

    expect(JSON.stringify(logger.entries)).not.toContain("secret-token");
    expect(JSON.stringify(logger.entries)).not.toContain("u9:600");
  });
});
