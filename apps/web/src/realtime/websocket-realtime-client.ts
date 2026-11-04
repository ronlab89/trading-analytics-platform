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
}

const NORMAL_CLOSURE = 1000;

/**
 * The `RealtimeClient` over the server WebSocket (ADR-007, docs/08). It authenticates in the first
 * message, asks for each channel once however many listeners it has, validates every event against
 * the contract and gives it to the listeners of its channel. Reconnection, token renewal and
 * resynchronization are added on top of this in the next steps.
 */
export function createWebSocketRealtimeClient({
  url,
  getAccessToken,
  createSocket = createBrowserSocket,
  logger,
}: WebSocketRealtimeClientOptions): RealtimeClient {
  let state: ConnectionState = "disconnected";
  let socket: RealtimeSocket | undefined;
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

  function open() {
    const token = getAccessToken();
    if (token === undefined) return;

    setState("connecting");
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
      onClose() {
        if (socket !== current) return;
        socket = undefined;
        setState("disconnected");
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
      closing?.close(NORMAL_CLOSURE);
      setState("disconnected");
    },
    retry() {
      if (state === "failed") open();
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
