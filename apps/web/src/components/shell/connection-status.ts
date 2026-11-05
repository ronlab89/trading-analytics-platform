import type { ConnectionState as TransportState } from "@/realtime/realtime-client";
import type { Calculation, ConnectionState, LastSync } from "./status-bar";

interface ConnectionStatusInput {
  state: TransportState;
  /** When data last arrived, in epoch milliseconds, or `undefined` when none has yet. */
  lastDataAt: number | undefined;
  now: number;
  /** The time of the last calculation, shown while the connection is not lost. */
  calculationTime: string;
}

interface ConnectionStatus {
  connection: ConnectionState;
  lastSync: LastSync;
  calculation: Calculation;
}

const CONNECTION: Record<TransportState, ConnectionState> = {
  connected: "live",
  connecting: "connecting",
  reconnecting: "reconnecting",
  disconnected: "offline",
  failed: "offline",
};

const pad = (value: number) => String(value).padStart(2, "0");

/** The local time of day as the status bar writes it, `14:31:55`. */
function clockTime(epoch: number): string {
  const date = new Date(epoch);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * What the status bar says for a state of the realtime connection (docs FE3.0 §1): a live
 * connection counts the seconds since the last data; any other shows the time of the last data
 * it has, and a lost one says the calculation stopped.
 */
export function connectionToStatus({
  state,
  lastDataAt,
  now,
  calculationTime,
}: ConnectionStatusInput): ConnectionStatus {
  const lost = state === "disconnected" || state === "failed";
  const calculation: Calculation = lost
    ? { kind: "stopped" }
    : { kind: "upToDate", time: calculationTime };

  if (lastDataAt === undefined) {
    return { connection: CONNECTION[state], lastSync: { kind: "waiting" }, calculation };
  }
  const lastSync: LastSync =
    state === "connected"
      ? { kind: "syncedAgo", seconds: Math.max(0, Math.floor((now - lastDataAt) / 1000)) }
      : { kind: "lastDataAt", time: clockTime(lastDataAt) };
  return { connection: CONNECTION[state], lastSync, calculation };
}
