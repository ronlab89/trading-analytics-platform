import { describe, expect, it } from "vitest";
import {
  MAX_ACCESS_TOKEN_LENGTH,
  REALTIME_CLOSE_CODES,
  REALTIME_ERROR_CODES,
  REALTIME_LIMITS,
  clientMessageSchema,
  serverReplySchema,
} from "./realtime-protocol.schema.js";

describe("client messages", () => {
  it.each([
    { type: "AUTHENTICATE", accessToken: "a.b.c" },
    { type: "SUBSCRIBE", channel: "market:asset_001" },
    { type: "SUBSCRIBE", channel: "notifications" },
    { type: "UNSUBSCRIBE", channel: "portfolio:p1" },
  ])("accepts %j", (message) => {
    expect(clientMessageSchema.safeParse(message).success).toBe(true);
  });

  it.each([
    ["an unknown type", { type: "PING" }],
    ["no type", { channel: "notifications" }],
    ["an empty token", { type: "AUTHENTICATE", accessToken: "" }],
    ["a missing token", { type: "AUTHENTICATE" }],
    [
      "a token over the limit",
      { type: "AUTHENTICATE", accessToken: "x".repeat(MAX_ACCESS_TOKEN_LENGTH + 1) },
    ],
    ["a subscription without a channel", { type: "SUBSCRIBE" }],
    ["a malformed channel", { type: "SUBSCRIBE", channel: "market:" }],
    ["an unknown channel", { type: "SUBSCRIBE", channel: "user:u1" }],
    ["a non-object", "SUBSCRIBE"],
    ["null", null],
  ])("rejects %s", (_name, message) => {
    expect(clientMessageSchema.safeParse(message).success).toBe(false);
  });
});

describe("server replies", () => {
  it("accepts an ACK of each request and an ERROR with each code", () => {
    for (const request of ["AUTHENTICATE", "SUBSCRIBE", "UNSUBSCRIBE"] as const) {
      expect(serverReplySchema.safeParse({ type: "ACK", request }).success).toBe(true);
    }
    expect(
      serverReplySchema.safeParse({ type: "ACK", request: "SUBSCRIBE", channel: "jobs:j1" })
        .success,
    ).toBe(true);

    for (const code of REALTIME_ERROR_CODES) {
      expect(
        serverReplySchema.safeParse({ type: "ERROR", code, message: "Refused." }).success,
      ).toBe(true);
    }
  });

  it("rejects an ERROR without a code or with an unknown one, and an ACK of another request", () => {
    expect(serverReplySchema.safeParse({ type: "ERROR", message: "x" }).success).toBe(false);
    expect(serverReplySchema.safeParse({ type: "ERROR", code: "BOOM", message: "x" }).success).toBe(
      false,
    );
    expect(serverReplySchema.safeParse({ type: "ACK", request: "PING" }).success).toBe(false);
  });
});

describe("close codes and limits", () => {
  it("names the four close codes of ADR-007", () => {
    expect(REALTIME_CLOSE_CODES).toEqual({
      UNAUTHENTICATED: 4001,
      TOKEN_EXPIRED: 4002,
      LIMIT_EXCEEDED: 4008,
      GOING_AWAY: 1001,
    });
  });

  it("holds the limit values decided in ADR-007 and ADR-005", () => {
    expect(REALTIME_LIMITS).toEqual({
      authenticationTimeoutMs: 5000,
      maxSubscriptionsPerConnection: 50,
      maxInboundMessagesPerSecond: 20,
      maxOutboundBufferBytes: 1_048_576,
      maxInboundPayloadBytes: 65_536,
      heartbeatIntervalMs: 30_000,
      missedPongsBeforeClose: 2,
      maxConnectionsPerUser: 5,
    });
  });
});
