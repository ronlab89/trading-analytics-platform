import type { Logger } from "@trading/application";
import {
  channelName,
  realtimeEventSchema,
  serverReplySchema,
  type RealtimeChannel,
  type RealtimeEvent,
} from "@trading/contracts";
import type {
  ConnectionState,
  RealtimeClient,
  RealtimeListener,
  ResyncReason,
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
  /**
   * Calls `onChange` whenever the session token is renewed or removed, and returns the function that
   * stops it. The client listens from `connect()` until `disconnect()`.
   */
  watchAccessToken?: (onChange: () => void) => () => void;
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
 * new one after a growing delay. A renewed token is sent over the same socket, and a removed one
 * closes it. It keeps the last sequence and epoch of each channel to discard duplicate and stale
 * events, and tells the resync listeners when what is on screen may no longer be true (docs/08 §24-§26).
 */
export function createWebSocketRealtimeClient({
  url,
  getAccessToken,
  watchAccessToken,
  createSocket = createBrowserSocket,
  logger,
  random,
}: WebSocketRealtimeClientOptions): RealtimeClient {
  let state: ConnectionState = "disconnected";
  let socket: RealtimeSocket | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  /** Failed attempts in a row since the last time the connection was authenticated. */
  let failedAttempts = 0;
  /** The token the server has last been given, to tell a renewal from a repeated notice. */
  let sentToken: string | undefined;
  let stopWatchingToken: (() => void) | undefined;
  /** The connection was lost since the last time it was authenticated, so a reconnect needs a resync. */
  let lostConnection = false;
  /** The last event applied on each subscribed channel. */
  const lastApplied = new Map<string, { sequence: number; epoch: string }>();
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

  function signalResync(reason: ResyncReason, channel: string | null) {
    resyncListeners.forEach((listener) => {
      try {
        listener({ reason, channel });
      } catch (error) {
        logger?.warn("realtime.resync.listener.failed", {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /** Whether an event is new for its channel; a gap or a new epoch also asks for a resync. */
  function isNew({ channel, sequence, epoch }: RealtimeEvent): boolean {
    const last = lastApplied.get(channel);
    if (last === undefined) {
      lastApplied.set(channel, { sequence, epoch });
      return true;
    }
    if (last.epoch !== epoch) {
      // The server restarted and its sequence started over: ours means nothing any more.
      lastApplied.set(channel, { sequence, epoch });
      signalResync("epoch", channel);
      return true;
    }
    if (sequence <= last.sequence) return false;
    if (sequence > last.sequence + 1) signalResync("gap", channel);
    last.sequence = sequence;
    return true;
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
        // The ACK of a renewal over a connection already open must not ask for the channels again.
        const isRenewal = state === "connected";
        setState("connected");
        if (!isRenewal) {
          for (const name of channelListeners.keys()) send({ type: "SUBSCRIBE", channel: name });
          if (lostConnection) {
            // Subscribed first, so what happens while the snapshot is fetched is not lost (§26).
            lostConnection = false;
            lastApplied.clear();
            signalResync("reconnect", null);
          }
        }
      }
      return;
    }

    const event = realtimeEventSchema.safeParse(message);
    if (!event.success) {
      dropped("invalid-event");
      return;
    }
    const listeners = channelListeners.get(event.data.channel);
    if (listeners === undefined || !isNew(event.data)) return;
    listeners.forEach((listener) => {
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

  function handleTokenChange() {
    const token = getAccessToken();
    if (token === undefined) {
      // Signing out is an intentional close: no reconnection.
      close();
      return;
    }
    // Only an open, authenticated socket is renewed; any other will read the new token when it opens.
    if (state === "connected" && token !== sentToken) {
      sentToken = token;
      send({ type: "AUTHENTICATE", accessToken: token });
    }
  }

  function close() {
    const closing = socket;
    socket = undefined;
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    failedAttempts = 0;
    lostConnection = false;
    lastApplied.clear();
    stopWatchingToken?.();
    stopWatchingToken = undefined;
    closing?.close(NORMAL_CLOSURE);
    setState("disconnected");
  }

  /** Opens a socket and says whether it did: with no session there is nothing to authenticate with. */
  function open(): boolean {
    const token = getAccessToken();
    if (token === undefined) {
      close();
      return false;
    }

    if (state !== "reconnecting") setState("connecting");
    // Each socket gets its own handlers: what a socket we already left says is not listened to.
    const handlers: SocketHandlers = {
      onOpen() {
        if (socket !== current) return;
        sentToken = token;
        send({ type: "AUTHENTICATE", accessToken: token });
      },
      onMessage(data) {
        if (socket !== current) return;
        handleMessage(data);
      },
      onClose(code) {
        if (socket !== current) return;
        socket = undefined;
        lostConnection = true;
        // 4008: the server refused us for exceeding a limit, and asking again would only repeat it.
        // Any other close (4001, 4002, 1001, a lost socket) is worth another try with a fresh token.
        if (code === LIMIT_EXCEEDED) fail("limit-exceeded", code);
        else scheduleReconnect(code);
      },
    };
    const current = createSocket(url, handlers);
    socket = current;
    return true;
  }

  return {
    connect() {
      if (state !== "disconnected") return;
      if (open()) stopWatchingToken = watchAccessToken?.(handleTokenChange);
    },
    disconnect: close,
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
        lastApplied.delete(name);
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
