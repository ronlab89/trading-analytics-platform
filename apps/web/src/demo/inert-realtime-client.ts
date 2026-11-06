import type { ConnectionState, RealtimeClient } from "@/realtime/realtime-client";

/** Placeholder until the in-process realtime of FE4.3: it never connects and never emits. */
export function createInertRealtimeClient(): RealtimeClient {
  const state: ConnectionState = "disconnected";
  return {
    connect: () => undefined,
    disconnect: () => undefined,
    retry: () => undefined,
    subscribe: () => () => undefined,
    getState: () => state,
    onStateChange: () => () => undefined,
    onResync: () => () => undefined,
  };
}
