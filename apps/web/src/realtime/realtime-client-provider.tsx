import { createContext, use, useSyncExternalStore, type ReactNode } from "react";
import type { ConnectionState, RealtimeClient } from "./realtime-client";

const RealtimeClientContext = createContext<RealtimeClient | undefined>(undefined);

interface RealtimeClientProviderProps {
  client: RealtimeClient;
  children: ReactNode;
}

/** Hands the one `RealtimeClient` of the app to the hooks, so a test or the demo can swap it. */
export function RealtimeClientProvider({ client, children }: RealtimeClientProviderProps) {
  return <RealtimeClientContext value={client}>{children}</RealtimeClientContext>;
}

export function useRealtimeClient(): RealtimeClient {
  const client = use(RealtimeClientContext);
  if (!client) {
    throw new Error("useRealtimeClient must be used inside a RealtimeClientProvider");
  }
  return client;
}

/** The state of the connection, for the status bar and the stale-data alert. */
export function useConnectionState(): ConnectionState {
  const client = useRealtimeClient();
  return useSyncExternalStore(
    (listener) => client.onStateChange(listener),
    () => client.getState(),
  );
}
