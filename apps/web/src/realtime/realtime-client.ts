import type { RealtimeChannel, RealtimeEvent } from "@trading/contracts";

/**
 * The client side of the transport states (docs/08 §6). `connected` means the socket is open and
 * authenticated, not only open. They describe the transport, never a domain entity, and a change
 * creates no notification: it shows in the status bar and in the stale-data alert.
 */
export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "reconnecting" | "failed";

export type RealtimeListener = (event: RealtimeEvent) => void;

/**
 * Why what is on screen may no longer be true: events were missed (`gap`), the connection came
 * back after a loss (`reconnect`), or the server restarted and its sequence started over
 * (`epoch`). The answer is the same for all three: read the resource again over HTTP (docs/08 §26).
 */
export type ResyncReason = "gap" | "reconnect" | "epoch";

export interface ResyncSignal {
  reason: ResyncReason;
  /** The channel that lost events, or `null` when every subscription may have. */
  channel: string | null;
}

/**
 * The only way the UI reaches the realtime feed, as `TradingClient` is for requests (ADR-007 point
 * 13). The WebSocket adapter talks to the server; the demo adapter runs in the browser. Hooks and
 * screens depend on this interface and never on a `WebSocket`.
 */
export interface RealtimeClient {
  /** Opens the connection and keeps it open. Calling it while open or opening does nothing. */
  connect(): void;
  /** Closes it on purpose: no reconnection, and the state becomes `disconnected`. */
  disconnect(): void;
  /** The manual retry that follows `failed`. */
  retry(): void;
  /**
   * Listens to one channel. Several listeners of the same channel share one subscription on the
   * wire, which ends when the last one leaves. The returned function leaves.
   */
  subscribe(channel: RealtimeChannel, listener: RealtimeListener): () => void;
  getState(): ConnectionState;
  /** Calls back on every change of state; the shape `useSyncExternalStore` expects. */
  onStateChange(listener: () => void): () => void;
  onResync(listener: (signal: ResyncSignal) => void): () => void;
}
