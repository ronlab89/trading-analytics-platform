import type { Clock, Logger } from "@trading/application";
import type { UserRole } from "@trading/domain";
import {
  REALTIME_CLOSE_CODES,
  REALTIME_LIMITS,
  clientMessageSchema,
  type ClientMessage,
  type RealtimeErrorCode,
  type ServerReply,
} from "@trading/contracts";
import { LOG_EVENTS } from "../logging/events.js";
import type { RealtimeAuthenticator } from "./access-token-authenticator.js";
import { createConnectionRegistry } from "./connection-registry.js";
import type { RealtimeSocket, RealtimeTransport } from "./transport.js";

export type RealtimeLimits = Record<keyof typeof REALTIME_LIMITS, number>;

/** An authenticated socket, as the rest of the realtime server sees it. */
export interface RealtimeConnection {
  readonly id: string;
  readonly userId: string;
  readonly role: UserRole;
  /** Sends a JSON message; false when the socket is closed or the send closed it. */
  send: (message: unknown) => boolean;
  close: (code: number, reason: string) => void;
  /** False once the socket is closing or closed, so a late async result can tell. */
  isOpen: () => boolean;
}

/**
 * Handles the messages of an authenticated connection other than `AUTHENTICATE`.
 * The gateway runs the handler calls of one connection one after the other, in
 * arrival order, so an async handler cannot reorder a `SUBSCRIBE` and the
 * `UNSUBSCRIBE` that follows it. A rejection is logged and never closes the socket.
 */
export type RealtimeMessageHandler = (
  connection: RealtimeConnection,
  message: Exclude<ClientMessage, { type: "AUTHENTICATE" }>,
) => void | Promise<void>;

export interface RealtimeGatewayOptions {
  transport: RealtimeTransport;
  authenticate: RealtimeAuthenticator;
  clock: Clock;
  logger: Logger;
  newId: () => string;
  /** Overrides the limits of version 1; tests shorten the timers. */
  limits?: Partial<RealtimeLimits>;
  handleMessage?: RealtimeMessageHandler;
  /** Called once when an authenticated connection closes, whoever closed it. */
  onConnectionClosed?: (connection: RealtimeConnection) => void;
}

export interface RealtimeGateway {
  /** Starts accepting connections from the transport. */
  start: () => void;
  /** Stops accepting connections and closes every socket with `1001`. */
  stop: () => Promise<void>;
}

/** The longest delay `setTimeout` accepts. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * The realtime server logic over a transport (ADR-007 points 2, 11, 15, 16).
 *
 * A socket authenticates with its first message within the timeout, is bound
 * to the expiry of its token, and is closed with a `REALTIME_CLOSE_CODES` code
 * when it breaks a limit. At most `maxConnectionsPerUser` authenticated
 * sockets per user stay open: the new one beyond the cap is the one closed.
 */
export function createRealtimeGateway(options: RealtimeGatewayOptions): RealtimeGateway {
  const { transport, authenticate, clock, logger, newId, handleMessage, onConnectionClosed } =
    options;
  const limits: RealtimeLimits = { ...REALTIME_LIMITS, ...options.limits };
  const registry = createConnectionRegistry<RealtimeConnection>();
  const open = new Set<{ close: (code: number, reason: string) => void }>();
  let stopping = false;

  function handleConnection(socket: RealtimeSocket): void {
    const connectionId = newId();
    const self = { close };
    let connection: RealtimeConnection | undefined;
    let expiresAt: Date | undefined;
    let closing = false;
    let missedPongs = 0;
    let pingPending = false;
    let windowStartedAt = clock.now().getTime();
    let messagesInWindow = 0;
    let expiryTimer: NodeJS.Timeout | undefined;
    let inbound: Promise<void> = Promise.resolve();

    const fields = () => ({ connectionId, ...(connection ? { userId: connection.userId } : {}) });

    function close(code: number, reason: string): void {
      if (closing) {
        return;
      }
      closing = true;
      socket.close(code, reason);
    }

    function send(message: unknown): boolean {
      if (closing) {
        return false;
      }
      const data = JSON.stringify(message);
      if (socket.bufferedAmount + Buffer.byteLength(data) > limits.maxOutboundBufferBytes) {
        logger.warn(LOG_EVENTS.realtimeConnectionLimitExceeded, {
          ...fields(),
          limit: "outboundBuffer",
        });
        close(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED, "Outbound buffer limit exceeded.");
        return false;
      }
      socket.send(data);
      return true;
    }

    function reply(message: ServerReply): void {
      send(message);
    }

    function fail(code: RealtimeErrorCode, message: string): void {
      reply({ type: "ERROR", code, message });
    }

    function rejectAuthentication(): void {
      logger.warn(LOG_EVENTS.realtimeConnectionAuthFailed, fields());
      fail("INVALID_TOKEN", "Invalid access token.");
      close(REALTIME_CLOSE_CODES.UNAUTHENTICATED, "Invalid access token.");
    }

    function bindToExpiry(until: Date): void {
      clearTimeout(expiryTimer);
      expiresAt = until;
      const delay = Math.min(Math.max(until.getTime() - clock.now().getTime(), 0), MAX_TIMER_MS);
      expiryTimer = setTimeout(() => {
        close(REALTIME_CLOSE_CODES.TOKEN_EXPIRED, "Access token expired.");
      }, delay);
    }

    function handleAuthenticate(accessToken: string): void {
      let identity;
      try {
        identity = authenticate(accessToken);
      } catch {
        rejectAuthentication();
        return;
      }

      if (connection === undefined) {
        if (registry.countOf(identity.userId) >= limits.maxConnectionsPerUser) {
          logger.warn(LOG_EVENTS.realtimeConnectionRejected, {
            connectionId,
            userId: identity.userId,
            limit: "connectionsPerUser",
          });
          close(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED, "Too many connections.");
          return;
        }
        connection = {
          id: connectionId,
          userId: identity.userId,
          role: identity.role,
          send,
          close,
          isOpen: () => !closing,
        };
        registry.add(connection);
        clearTimeout(authenticationTimer);
        logger.info(LOG_EVENTS.realtimeConnectionAuthenticated, fields());
      } else if (connection.userId !== identity.userId) {
        // A token of another user never takes over a socket.
        rejectAuthentication();
        return;
      }

      bindToExpiry(identity.expiresAt);
      reply({ type: "ACK", request: "AUTHENTICATE" });
    }

    function parse(data: string): ClientMessage | undefined {
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        return undefined;
      }
      const parsed = clientMessageSchema.safeParse(json);
      return parsed.success ? parsed.data : undefined;
    }

    function withinRate(): boolean {
      const now = clock.now().getTime();
      if (now - windowStartedAt >= 1000) {
        windowStartedAt = now;
        messagesInWindow = 0;
      }
      messagesInWindow += 1;
      return messagesInWindow <= limits.maxInboundMessagesPerSecond;
    }

    function handleData(data: string): void {
      if (closing) {
        return;
      }
      if (!withinRate()) {
        logger.warn(LOG_EVENTS.realtimeConnectionLimitExceeded, {
          ...fields(),
          limit: "inboundRate",
        });
        close(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED, "Message rate limit exceeded.");
        return;
      }

      const message = parse(data);
      if (message === undefined) {
        fail("INVALID_MESSAGE", "Invalid message.");
        if (connection === undefined) {
          close(REALTIME_CLOSE_CODES.UNAUTHENTICATED, "Authentication required.");
        }
        return;
      }

      if (message.type === "AUTHENTICATE") {
        handleAuthenticate(message.accessToken);
      } else if (connection === undefined) {
        fail("UNAUTHENTICATED", "Authenticate first.");
        close(REALTIME_CLOSE_CODES.UNAUTHENTICATED, "Authentication required.");
      } else if (handleMessage) {
        const current = connection;
        inbound = inbound
          .then(() => handleMessage(current, message))
          .catch((error: unknown) => {
            logger.error(LOG_EVENTS.realtimeHandlerFailed, {
              ...fields(),
              messageType: message.type,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      } else {
        fail("INVALID_MESSAGE", "Message not supported.");
      }
    }

    function heartbeat(): void {
      if (pingPending) {
        missedPongs += 1;
      }
      if (missedPongs >= limits.missedPongsBeforeClose) {
        logger.warn(LOG_EVENTS.realtimeConnectionLimitExceeded, { ...fields(), limit: "pong" });
        close(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED, "Heartbeat lost.");
        return;
      }
      pingPending = true;
      socket.ping();
    }

    const authenticationTimer = setTimeout(() => {
      if (connection === undefined) {
        logger.warn(LOG_EVENTS.realtimeConnectionAuthFailed, { ...fields(), reason: "timeout" });
        close(REALTIME_CLOSE_CODES.UNAUTHENTICATED, "Authentication timeout.");
      }
    }, limits.authenticationTimeoutMs);
    const heartbeatTimer = setInterval(heartbeat, limits.heartbeatIntervalMs);

    open.add(self);
    logger.info(LOG_EVENTS.realtimeConnectionOpened, { connectionId });

    socket.onMessage(handleData);
    socket.onPong(() => {
      pingPending = false;
      missedPongs = 0;
    });
    socket.onClose((code) => {
      closing = true;
      clearTimeout(authenticationTimer);
      clearTimeout(expiryTimer);
      clearInterval(heartbeatTimer);
      open.delete(self);
      if (connection) {
        registry.remove(connection);
        onConnectionClosed?.(connection);
      }
      logger.info(LOG_EVENTS.realtimeConnectionClosed, {
        ...fields(),
        code,
        ...(expiresAt ? { tokenExpiresAt: expiresAt.toISOString() } : {}),
      });
    });
  }

  return {
    start() {
      transport.onConnection((socket) => {
        if (stopping) {
          socket.close(REALTIME_CLOSE_CODES.GOING_AWAY, "Server shutting down.");
          return;
        }
        handleConnection(socket);
      });
    },

    async stop() {
      stopping = true;
      for (const connection of open) {
        connection.close(REALTIME_CLOSE_CODES.GOING_AWAY, "Server shutting down.");
      }
      await transport.close(REALTIME_CLOSE_CODES.GOING_AWAY, "Server shutting down.");
    },
  };
}
