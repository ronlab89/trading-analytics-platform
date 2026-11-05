import type { Logger } from "@trading/application";
import {
  channelName,
  realtimeEventSchema,
  serverReplySchema,
  type RealtimeChannel,
} from "@trading/contracts";
import type {
  ConnectionState,
  RealtimeClient,
  RealtimeListener,
  ResyncSignal,
} from "./realtime-client";
import { nextReconnectDelay } from "./reconnect-backoff";

/** What the adapter needs of a socket, so a test can stand in for the browser one. */
export interface RealtimeSocket {
  send(data: string): void;
  close(code?: number): void;
}

/** What the socket tells the adapter. A handler of a socket that is no longer the current one is ignored. */
export interface SocketHandlers {
  onOpen(): void;
  onMessage(data: unknown): void;
  onClose(code: number): void;
}

export type CreateSocket = (url: string, handlers: SocketHandlers) => RealtimeSocket;

/** The browser `WebSocket` behind the small shape above. */
export const createBrowserSocket: CreateSocket = (url, handlers) => {
  const socket = new WebSocket(url);
  socket.onopen = () => {
    handlers.onOpen();
  };
  socket.onmessage = (event) => {
    handlers.onMessage(event.data);
  };
  socket.onclose = (event) => {
    handlers.onClose(event.code);
  };
  return {
    send: (data) => {
      socket.send(data);
    },
    close: (code) => {
      socket.close(code);
    },
  };
};

interface WebSocketRealtimeClientOptions {
  /** The address of the server socket; the token never goes in it (ADR-007 point 2). */
  url: string;
  /** The access token of the session, read each time the connection authenticates. */
  getAccessToken: () => string | undefined;
  createSocket?: CreateSocket;
  logger?: Pick<Logger, "warn">;
  /** Feeds the jitter of the reconnection delay; replaceable in tests. */
  random?: () => number;
}

const NORMAL_CLOSURE = 1000;
const LIMIT_EXCEEDED = 4008;
/** Closes in a row without an authenticated connection in between after which we stop trying. */
const MAX_FAILED_ATTEMPTS = 10;

/**
 * The `RealtimeClient` over the server WebSocket (ADR-007, docs/08). It authenticates in the first
 * message, asks for each channel once however many listeners it has, validates every event against
 * the contract and gives it to the listeners of its channel. When the connection is lost it opens a
 * new one after a growing delay. Token renewal and resynchronization are added on top of this in
 * the next steps.
 */
export function createWebSocketRealtimeClient({
  url,
  getAccessToken,
  createSocket = createBrowserSocket,
  logger,
  random,
}: WebSocketRealtimeClientOptions): RealtimeClient {
  let state: ConnectionState = "disconnected";
  let socket: RealtimeSocket | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  /** Failed attempts in a row since the last time the connection was authenticated. */
  let failedAttempts = 0;
  const stateListeners = new Set<() => void>();
  const resyncListeners = new Set<(signal: ResyncSignal) => void>();
  const channelListeners = new Map<string, Set<RealtimeListener>>();

  function setState(next: ConnectionState) {
    if (next === state) return;
    state = next;
    stateListeners.forEach((listener) => {
      listener();
    });
  }

  function send(message: unknown) {
    socket?.send(JSON.stringify(message));
  }

  function dropped(reason: string) {
    logger?.warn("realtime.message.dropped", { reason });
  }

  function handleMessage(data: unknown) {
    let message: unknown;
    try {
      message = JSON.parse(String(data));
    } catch {
      dropped("not-json");
      return;
    }

    const reply = serverReplySchema.safeParse(message);
    if (reply.success) {
      if (reply.data.type === "ACK" && reply.data.request === "AUTHENTICATE") {
        failedAttempts = 0;
        setState("connected");
        for (const name of channelListeners.keys()) send({ type: "SUBSCRIBE", channel: name });
      }
      return;
    }

    const event = realtimeEventSchema.safeParse(message);
    if (!event.success) {
      dropped("invalid-event");
      return;
    }
    channelListeners.get(event.data.channel)?.forEach((listener) => {
      try {
        listener(event.data);
      } catch (error) {
        logger?.warn("realtime.listener.failed", {
          channel: event.data.channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  function fail(reason: string, code: number) {
    logger?.warn("realtime.connection.failed", { reason, code });
    setState("failed");
  }

  function scheduleReconnect(code: number) {
    failedAttempts += 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      fail("attempts-exhausted", code);
      return;
    }
    setState("reconnecting");
    reconnectTimer = setTimeout(
      () => {
        reconnectTimer = undefined;
        open();
      },
      nextReconnectDelay(failedAttempts, random),
    );
  }

  function open() {
    const token = getAccessToken();
    if (token === undefined) {
      // The session ended while we waited: there is nothing to authenticate with.
      setState("disconnected");
      return;
    }

    if (state !== "reconnecting") setState("connecting");
    // Each socket gets its own handlers: what a socket we already left says is not listened to.
    const handlers: SocketHandlers = {
      onOpen() {
        if (socket !== current) return;
        send({ type: "AUTHENTICATE", accessToken: token });
      },
      onMessage(data) {
        if (socket !== current) return;
        handleMessage(data);
      },
      onClose(code) {
        if (socket !== current) return;
        socket = undefined;
        // 4008: the server refused us for exceeding a limit, and asking again would only repeat it.
        // Any other close (4001, 4002, 1001, a lost socket) is worth another try with a fresh token.
        if (code === LIMIT_EXCEEDED) fail("limit-exceeded", code);
        else scheduleReconnect(code);
      },
    };
    const current = createSocket(url, handlers);
    socket = current;
  }

  return {
    connect() {
      if (state !== "disconnected") return;
      open();
    },
    disconnect() {
      const closing = socket;
      socket = undefined;
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      failedAttempts = 0;
      closing?.close(NORMAL_CLOSURE);
      setState("disconnected");
    },
    retry() {
      if (state !== "failed") return;
      failedAttempts = 0;
      open();
    },
    subscribe(channel: RealtimeChannel, listener: RealtimeListener) {
      const name = channelName(channel);
      const listeners = channelListeners.get(name) ?? new Set<RealtimeListener>();
      const isFirst = listeners.size === 0;
      listeners.add(listener);
      channelListeners.set(name, listeners);
      if (isFirst && state === "connected") send({ type: "SUBSCRIBE", channel: name });

      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        channelListeners.delete(name);
        if (state === "connected") send({ type: "UNSUBSCRIBE", channel: name });
      };
    },
    getState: () => state,
    onStateChange(listener) {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    onResync(listener) {
      resyncListeners.add(listener);
      return () => {
        resyncListeners.delete(listener);
      };
    },
  };
}
