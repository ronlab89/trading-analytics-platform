import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useConnectionState } from "@/realtime/realtime-client-provider";

/** How often the visible data is read again over HTTP while the socket is down (docs/08 §30). */
export const POLLING_INTERVAL_MS = 10_000;

/**
 * While the realtime connection is lost, reads the data on screen again every 10 seconds, so it
 * does not go stale in silence. It stops as soon as the connection is back. `disconnected` and
 * `connecting` do not poll: the first has no session and the second has lost nothing yet.
 */
export function useRealtimeFallback() {
  const queryClient = useQueryClient();
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
}
