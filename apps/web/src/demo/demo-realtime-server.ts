import type { Clock } from "@trading/application";
import { REALTIME_CLOSE_CODES, REALTIME_LIMITS, clientMessageSchema } from "@trading/contracts";
import type { RealtimeErrorCode } from "@trading/contracts";
import type { CreateSocket, SocketHandlers } from "@/realtime/websocket-realtime-client";

/** What a producer hands over: the server adds the id, the sequence, the timestamp and the epoch. */
export interface DemoRealtimeEvent {
  readonly type: string;
  /** The wire name of the channel, such as `market:<assetId>` or `notifications`. */
  readonly channel: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface DemoRealtimeServer {
  /** The socket factory of the WebSocket client: it connects to this server instead of the network. */
  readonly createSocket: CreateSocket;
  /** Delivers the event to every authenticated connection subscribed to its channel. */
  publish(event: DemoRealtimeEvent): void;
  /** Closes every open connection from the server side, as a lost connection would (FE4.4). */
  dropConnections(code?: number): void;
  connectionCount(): number;
}

export interface DemoRealtimeServerOptions {
  readonly clock: Clock;
  /** Replaceable in tests; defaults to a random UUID. */
  readonly newId?: () => string;
  /** Identifies this run: a client resets its baseline when it changes. Defaults to a new id. */
  readonly epoch?: string;
}

interface Connection {
  readonly handlers: SocketHandlers;
  readonly channels: Set<string>;
  open: boolean;
  authenticated: boolean;
}

/**
 * The server half of the in-process realtime of the demo (ADR-012 point 7). It speaks the wire protocol
 * of `docs/08` to the real `WebSocketRealtimeClient`, so the demo reuses its states, reconnection,
 * sequence check and resync instead of a second client. Like the API hub, every channel counts its own
 * `sequence` from 1. It delivers asynchronously, as a socket would: the client assigns its socket after
 * `createSocket` returns, so nothing may reach it before that.
 */
export function createDemoRealtimeServer(options: DemoRealtimeServerOptions): DemoRealtimeServer {
  const { clock, newId = () => crypto.randomUUID() } = options;
  const epoch = options.epoch ?? newId();
  const connections = new Set<Connection>();
  const sequenceByChannel = new Map<string, number>();

  function deliver(connection: Connection, message: unknown) {
    queueMicrotask(() => {
      if (connection.open) connection.handlers.onMessage(JSON.stringify(message));
    });
  }

  function refuse(
    connection: Connection,
    code: RealtimeErrorCode,
    message: string,
    channel?: string,
  ) {
    deliver(connection, {
      type: "ERROR",
      code,
      message,
      ...(channel !== undefined ? { channel } : {}),
    });
  }

  function receive(connection: Connection, data: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      refuse(connection, "INVALID_MESSAGE", "The message is not JSON.");
      return;
    }
    const message = clientMessageSchema.safeParse(parsed);
    if (!message.success) {
      refuse(connection, "INVALID_MESSAGE", "The message is not part of the protocol.");
      return;
    }

    const request = message.data;
    if (request.type === "AUTHENTICATE") {
      connection.authenticated = true;
      deliver(connection, { type: "ACK", request: "AUTHENTICATE" });
      return;
    }
    if (!connection.authenticated) {
      refuse(connection, "UNAUTHENTICATED", "Authenticate first.");
      return;
    }

    if (request.type === "UNSUBSCRIBE") {
      connection.channels.delete(request.channel);
      deliver(connection, { type: "ACK", request: "UNSUBSCRIBE", channel: request.channel });
      return;
    }
    const isNew = !connection.channels.has(request.channel);
    if (isNew && connection.channels.size >= REALTIME_LIMITS.maxSubscriptionsPerConnection) {
      refuse(connection, "SUBSCRIPTION_LIMIT", "Too many subscriptions.", request.channel);
      return;
    }
    connection.channels.add(request.channel);
    deliver(connection, { type: "ACK", request: "SUBSCRIBE", channel: request.channel });
  }

  return {
    createSocket: (_url, handlers) => {
      const connection: Connection = {
        handlers,
        channels: new Set(),
        open: true,
        authenticated: false,
      };
      connections.add(connection);
      queueMicrotask(() => {
        if (connection.open) handlers.onOpen();
      });
      return {
        send: (data) => {
          if (connection.open) receive(connection, data);
        },
        close: () => {
          connection.open = false;
          connections.delete(connection);
        },
      };
    },

    publish: ({ type, channel, payload }) => {
      const sequence = (sequenceByChannel.get(channel) ?? 0) + 1;
      sequenceByChannel.set(channel, sequence);
      const event = {
        id: newId(),
        type,
        channel,
        sequence,
        timestamp: clock.now().toISOString(),
        epoch,
        payload,
      };
      for (const connection of connections) {
        if (connection.authenticated && connection.channels.has(channel)) {
          deliver(connection, event);
        }
      }
    },

    dropConnections: (code = REALTIME_CLOSE_CODES.GOING_AWAY) => {
      for (const connection of [...connections]) {
        connection.open = false;
        connections.delete(connection);
        queueMicrotask(() => {
          connection.handlers.onClose(code);
        });
      }
    },

    connectionCount: () => connections.size,
  };
}
