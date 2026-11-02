import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StatusDot } from "@/components/status-dot";
import { formatLongDate, formatTimeOfDay } from "@/lib/format-date";

interface DashboardHeaderProps {
  portfolioName: string;
  positionCount: number;
  /** The day the line opens with, as an ISO instant; the page passes now, a test fixes it. */
  today: string;
  /** When the overview was last fetched, in epoch milliseconds (what the query keeps). */
  updatedAt: number;
  /** What sits at the end of the line: "Nueva transacción" while the portfolio is empty. */
  action?: ReactNode;
}

/**
 * The line under the top bar of the Figma "Inicio": the day, the portfolio and its positions at the
 * left; when the data was fetched and the main action at the right. The "Actualizado" time is the
 * last fetch, not a live feed: the realtime client arrives with FE3.
 */
export function DashboardHeader({
  portfolioName,
  positionCount,
  today,
  updatedAt,
  action,
}: DashboardHeaderProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-(--color-text-secondary)">
        {t("dashboard.header.summary", {
          date: formatLongDate(today, i18n.language),
          portfolio: portfolioName,
          count: positionCount,
        })}
      </p>
      <div className="flex items-center gap-4">
        <p className="flex items-center gap-1.5 text-xs text-(--color-text-secondary)">
          <StatusDot tone="success" />
          {t("dashboard.header.updated", {
            time: formatTimeOfDay(new Date(updatedAt).toISOString(), i18n.language),
          })}
        </p>
        {action}
      </div>
    </div>
  );
}
