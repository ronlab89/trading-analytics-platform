import type { RealtimeChannel, RealtimeEvent } from "@trading/contracts";
import { channelName } from "@trading/contracts";
import type {
  ConnectionState,
  RealtimeClient,
  RealtimeListener,
  ResyncSignal,
} from "@/realtime/realtime-client";

export interface FakeRealtimeClient extends RealtimeClient {
  /** Moves the connection to a state, as the real client would. */
  setState: (state: ConnectionState) => void;
  /** Delivers an event to the listeners of its channel. */
  emit: (event: RealtimeEvent) => void;
  /** Asks every resync listener to refetch, as a gap or a reconnect would. */
  resync: (signal: ResyncSignal) => void;
  /** The wire names of the channels with at least one listener. */
  subscribedChannels: () => string[];
  stateListenerCount: () => number;
  /** How many times each of `connect`, `disconnect` and `retry` was called. */
  calls: { connect: number; disconnect: number; retry: number };
}

/** A `RealtimeClient` the test drives by hand: no socket, no timers. */
export function createFakeRealtimeClient(
  initial: ConnectionState = "disconnected",
): FakeRealtimeClient {
  let state = initial;
  const stateListeners = new Set<() => void>();
  const resyncListeners = new Set<(signal: ResyncSignal) => void>();
  const channelListeners = new Map<string, Set<RealtimeListener>>();
  const calls = { connect: 0, disconnect: 0, retry: 0 };

  return {
    calls,
    connect() {
      calls.connect += 1;
    },
    disconnect() {
      calls.disconnect += 1;
    },
    retry() {
      calls.retry += 1;
    },
    subscribe(channel: RealtimeChannel, listener: RealtimeListener) {
      const name = channelName(channel);
      const listeners = channelListeners.get(name) ?? new Set<RealtimeListener>();
      listeners.add(listener);
      channelListeners.set(name, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) channelListeners.delete(name);
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
    setState(next) {
      state = next;
      stateListeners.forEach((listener) => {
        listener();
      });
    },
    emit(event) {
      channelListeners.get(event.channel)?.forEach((listener) => {
        listener(event);
      });
    },
    resync(signal) {
      resyncListeners.forEach((listener) => {
        listener(signal);
      });
    },
    subscribedChannels: () => [...channelListeners.keys()],
    stateListenerCount: () => stateListeners.size,
  };
}
