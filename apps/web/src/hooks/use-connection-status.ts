import { useEffect, useState } from "react";
import { connectionToStatus, type ConnectionStatus } from "@/components/shell/connection-status";
import { useConnectionState } from "@/realtime/realtime-client-provider";
import { useLastDataAt } from "./use-last-data-at";

const CLOCK_INTERVAL_MS = 1_000;

/**
 * What the status bar shows about the connection. The clock runs only while the connection is
 * live, because that is the only state that counts seconds.
 */
export function useConnectionStatus(calculationTime: string): ConnectionStatus {
  const state = useConnectionState();
  const lastDataAt = useLastDataAt();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (state !== "connected") return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, CLOCK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [state]);

  return connectionToStatus({ state, lastDataAt, now, calculationTime });
}
