import type { TFunction } from "i18next";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusItem } from "./status-item";

export type ConnectionState = "live" | "connecting" | "reconnecting" | "offline";

export type LastSync =
  | { kind: "syncedAgo"; seconds: number }
  | { kind: "lastDataAgo"; seconds: number }
  | { kind: "lastDataAt"; time: string }
  | { kind: "waiting" };

export type Calculation = { kind: "upToDate"; time: string } | { kind: "stopped" };

interface StatusBarProps {
  connection: ConnectionState;
  lastSync: LastSync;
  calculation: Calculation;
  alertCount: number;
}

const CONNECTION_TONE = {
  live: "success",
  connecting: "warning",
  reconnecting: "warning",
  offline: "error",
} as const;

function lastSyncText(t: TFunction, lastSync: LastSync): string {
  switch (lastSync.kind) {
    case "syncedAgo":
      return t("shell.lastSync.syncedAgo", { seconds: lastSync.seconds });
    case "lastDataAgo":
      return t("shell.lastSync.lastDataAgo", { seconds: lastSync.seconds });
    case "lastDataAt":
      return t("shell.lastSync.lastDataAt", { time: lastSync.time });
    case "waiting":
      return t("shell.lastSync.waiting");
  }
}

function calculationText(t: TFunction, calculation: Calculation): string {
  return calculation.kind === "upToDate"
    ? t("shell.calculation.upToDate", { time: calculation.time })
    : t("shell.calculation.stopped");
}

/**
 * The 28 px footer: real-time connection, last sync and last calculation on the left, the
 * alert count on the right. Mobile keeps only the connection and the alerts.
 */
export function StatusBar({ connection, lastSync, calculation, alertCount }: StatusBarProps) {
  const { t } = useTranslation();

  return (
    <footer
      aria-label={t("shell.statusBar")}
      className="flex h-7 shrink-0 items-center justify-between rounded-md bg-card px-3"
    >
      <div className="flex items-center gap-4">
        <StatusItem role="status" tone={CONNECTION_TONE[connection]}>
          {t(`shell.connection.${connection}`)}
        </StatusItem>
        <StatusItem className="hidden md:flex">{lastSyncText(t, lastSync)}</StatusItem>
        <StatusItem className="hidden md:flex">{calculationText(t, calculation)}</StatusItem>
      </div>
      <StatusItem icon={TriangleAlert}>{t("shell.alerts", { count: alertCount })}</StatusItem>
    </footer>
  );
}
