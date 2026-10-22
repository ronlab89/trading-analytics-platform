import type { ChannelAuthorizer, Logger } from "@trading/application";
import { REALTIME_CLOSE_CODES, REALTIME_LIMITS, parseChannel } from "@trading/contracts";
import type { RealtimeErrorCode } from "@trading/contracts";
import { LOG_EVENTS } from "../logging/events.js";
import type { RealtimeConnection, RealtimeMessageHandler } from "./realtime-gateway.js";
import type { RealtimeHub } from "./realtime-hub.js";

export interface SubscriptionHandlerOptions {
  hub: RealtimeHub;
  authorizer: Pick<ChannelAuthorizer, "canSubscribe">;
  logger: Logger;
  /** Overrides the cap of version 1; tests lower it. */
  maxSubscriptionsPerConnection?: number;
}

export interface SubscriptionHandler {
  handleMessage: RealtimeMessageHandler;
  /** Drops every subscription of a connection that closed. */
  handleConnectionClosed: (connection: RealtimeConnection) => void;
}

/**
 * `SUBSCRIBE` and `UNSUBSCRIBE` for authenticated connections
 * (ADR-007 points 3 and 15, 08-realtime-spec.md §10 to §13).
 *
 * Both are idempotent and answer `ACK`. A subscription is authorized by the
 * application layer on every request; a channel that is not allowed answers
 * `FORBIDDEN_CHANNEL` whether it is unknown, someone else's or forbidden to
 * the role, so the reply never says which. The 51st subscription of a
 * connection answers `SUBSCRIPTION_LIMIT` and closes it with `4008`. If the
 * authorization itself fails, the subscription is refused, never granted.
 */
export function createSubscriptionHandler(
  options: SubscriptionHandlerOptions,
): SubscriptionHandler {
  const {
    hub,
    authorizer,
    logger,
    maxSubscriptionsPerConnection = REALTIME_LIMITS.maxSubscriptionsPerConnection,
  } = options;

  function fail(
    connection: RealtimeConnection,
    code: RealtimeErrorCode,
    message: string,
    channel?: string,
  ): void {
    connection.send({ type: "ERROR", code, message, ...(channel ? { channel } : {}) });
  }

  async function isAllowed(
    connection: RealtimeConnection,
    channel: NonNullable<ReturnType<typeof parseChannel>>,
  ): Promise<boolean> {
    try {
      return await authorizer.canSubscribe(
        { userId: connection.userId, role: connection.role },
        channel,
      );
    } catch (error) {
      logger.error(LOG_EVENTS.realtimeHandlerFailed, {
        connectionId: connection.id,
        userId: connection.userId,
        messageType: "SUBSCRIBE",
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async function subscribe(connection: RealtimeConnection, name: string): Promise<void> {
    const channel = parseChannel(name);

    if (channel === null) {
      fail(connection, "INVALID_CHANNEL", "Unknown channel.", name);
      return;
    }

    const current = hub.channelsOf(connection);

    if (current.includes(name)) {
      connection.send({ type: "ACK", request: "SUBSCRIBE", channel: name });
      return;
    }

    if (current.length >= maxSubscriptionsPerConnection) {
      logger.warn(LOG_EVENTS.realtimeConnectionLimitExceeded, {
        connectionId: connection.id,
        userId: connection.userId,
        limit: "subscriptions",
      });
      fail(connection, "SUBSCRIPTION_LIMIT", "Too many subscriptions.", name);
      connection.close(REALTIME_CLOSE_CODES.LIMIT_EXCEEDED, "Subscription limit exceeded.");
      return;
    }

    const allowed = await isAllowed(connection, channel);

    // The socket may have closed while the authorization ran: subscribe nothing then.
    if (!connection.isOpen()) {
      return;
    }

    if (!allowed) {
      logger.warn(LOG_EVENTS.realtimeSubscriptionRefused, {
        connectionId: connection.id,
        userId: connection.userId,
        channel: name,
      });
      fail(connection, "FORBIDDEN_CHANNEL", "Channel not available.", name);
      return;
    }

    hub.subscribe(connection, name);
    connection.send({ type: "ACK", request: "SUBSCRIBE", channel: name });
  }

  function unsubscribe(connection: RealtimeConnection, name: string): void {
    hub.unsubscribe(connection, name);
    connection.send({ type: "ACK", request: "UNSUBSCRIBE", channel: name });
  }

  return {
    handleMessage: async (connection, message) => {
      if (message.type === "SUBSCRIBE") {
        await subscribe(connection, message.channel);
      } else {
        unsubscribe(connection, message.channel);
      }
    },
    handleConnectionClosed: (connection) => {
      hub.remove(connection);
    },
  };
}
