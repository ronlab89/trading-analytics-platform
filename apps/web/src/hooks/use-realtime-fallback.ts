import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useConnectionState, useRealtimeClient } from "@/realtime/realtime-client-provider";

/** How often the visible data is read again over HTTP while the socket is down (docs/08 §30). */
export const POLLING_INTERVAL_MS = 10_000;

/**
 * While the realtime connection is lost, reads the data on screen again every 10 seconds, so it
 * does not go stale in silence. It stops as soon as the connection is back. `disconnected` and
 * `connecting` do not poll: the first has no session and the second has lost nothing yet.
 *
 * It also reads that data once whenever the client says it may no longer be true (a gap, a new
 * epoch, or a reconnection, docs/08 §26). There is no map from a channel to its queries yet, so a
 * signal refreshes everything on screen; the screens that use a channel can narrow it later.
 */
export function useRealtimeFallback() {
  const queryClient = useQueryClient();
  const client = useRealtimeClient();
  const state = useConnectionState();
  const isDown = state === "reconnecting" || state === "failed";

  useEffect(() => {
    if (!isDown) return;
    const timer = setInterval(() => {
      // An unfinished request is left to finish: cancelling it every 10 s could starve a slow one.
      void queryClient.refetchQueries({ type: "active" }, { cancelRefetch: false });
    }, POLLING_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [queryClient, isDown]);

  useEffect(
    () =>
      client.onResync(() => {
        void queryClient.refetchQueries({ type: "active" }, { cancelRefetch: false });
      }),
    [client, queryClient],
  );
}
