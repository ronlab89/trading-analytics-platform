import { z } from "zod";
import { channelNameSchema } from "./realtime-channel.schema.js";

/**
 * Realtime protocol: the messages a client sends, the replies a server gives,
 * and the close codes.
 * Source: ADR-007 points 2 and 15, 08-realtime-spec.md §9, §23, §57.
 */

/** The longest access token the server reads from `AUTHENTICATE`; a JWT of this service is far shorter. */
export const MAX_ACCESS_TOKEN_LENGTH = 4096;

export const authenticateMessageSchema = z.object({
  type: z.literal("AUTHENTICATE"),
  accessToken: z.string().min(1).max(MAX_ACCESS_TOKEN_LENGTH),
});

export const subscribeMessageSchema = z.object({
  type: z.literal("SUBSCRIBE"),
  channel: channelNameSchema,
});

export const unsubscribeMessageSchema = z.object({
  type: z.literal("UNSUBSCRIBE"),
  channel: channelNameSchema,
});

/** What a client may send: authenticate (again, after a refresh), subscribe, unsubscribe. */
export const clientMessageSchema = z.discriminatedUnion("type", [
  authenticateMessageSchema,
  subscribeMessageSchema,
  unsubscribeMessageSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

/**
 * The `ERROR` codes of the protocol (the open detail of 08 §9, decided in
 * B5.1). `FORBIDDEN_CHANNEL` covers both an unauthorized and an unknown
 * resource, so a reply never reveals whether a portfolio or job exists.
 */
export const REALTIME_ERROR_CODES = [
  "INVALID_MESSAGE",
  "UNAUTHENTICATED",
  "INVALID_TOKEN",
  "INVALID_CHANNEL",
  "FORBIDDEN_CHANNEL",
  "SUBSCRIPTION_LIMIT",
  "RATE_LIMITED",
] as const;
export const realtimeErrorCodeSchema = z.enum(REALTIME_ERROR_CODES);
export type RealtimeErrorCode = z.infer<typeof realtimeErrorCodeSchema>;

/** Confirms the client message it answers; `channel` is present for a subscription change. */
export const ackMessageSchema = z.object({
  type: z.literal("ACK"),
  request: z.enum(["AUTHENTICATE", "SUBSCRIBE", "UNSUBSCRIBE"]),
  channel: channelNameSchema.optional(),
});

export const errorMessageSchema = z.object({
  type: z.literal("ERROR"),
  code: realtimeErrorCodeSchema,
  message: z.string().min(1),
  channel: z.string().optional(),
});

export const serverReplySchema = z.discriminatedUnion("type", [
  ackMessageSchema,
  errorMessageSchema,
]);
export type ServerReply = z.infer<typeof serverReplySchema>;

/** WebSocket close codes the server uses (ADR-007 points 2, 15 and 16). */
export const REALTIME_CLOSE_CODES = {
  /** Unauthenticated or invalid token, including the 5-second authentication timeout. */
  UNAUTHENTICATED: 4001,
  /** The token expired without re-authentication. */
  TOKEN_EXPIRED: 4002,
  /** A limit was exceeded, including an excess connection beyond the per-user cap. */
  LIMIT_EXCEEDED: 4008,
  /** The server is going away. */
  GOING_AWAY: 1001,
} as const;
export type RealtimeCloseCode = (typeof REALTIME_CLOSE_CODES)[keyof typeof REALTIME_CLOSE_CODES];

/** Limits of version 1 (ADR-007 point 15 and 16, ADR-005 point 13); the server enforces them in B5.2 and B5.3. */
export const REALTIME_LIMITS = {
  authenticationTimeoutMs: 5_000,
  maxSubscriptionsPerConnection: 50,
  maxInboundMessagesPerSecond: 20,
  maxOutboundBufferBytes: 1_048_576,
  maxInboundPayloadBytes: 65_536,
  heartbeatIntervalMs: 30_000,
  missedPongsBeforeClose: 2,
  maxConnectionsPerUser: 5,
} as const;
