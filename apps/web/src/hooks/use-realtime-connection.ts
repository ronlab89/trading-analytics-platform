import { useEffect } from "react";
import { useRealtimeClient } from "@/realtime/realtime-client-provider";
import { useSessionStatus } from "./use-session";

/**
 * Keeps the realtime connection open while there is a session and closes it when the session ends
 * or the app unmounts. A renewed token is handled by the client itself, over the same socket.
 */
export function useRealtimeConnection() {
  const client = useRealtimeClient();
  const status = useSessionStatus();

  useEffect(() => {
    if (status !== "authenticated") return;
    client.connect();
    return () => {
      client.disconnect();
    };
  }, [client, status]);
}
