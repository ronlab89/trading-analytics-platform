import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { formatSignedMoney } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { useAttribution } from "../hooks/use-attribution";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { toAttributionRows, type ContributionDirection } from "../lib/attribution-rows";
import { AnalyticsPanel, AnalyticsPanelError, AnalyticsPanelLoading } from "./analytics-panel";

interface AnalyticsAttributionPanelProps {
  portfolioId: string;
  period: AnalyticsPeriod;
  /** The portfolio has no positions, so there is nothing to attribute yet. */
  emptyPortfolio?: boolean;
}

const AMOUNT_COLORS = {
  GAIN: "text-(--color-trading-gain)",
  LOSS: "text-(--color-trading-loss)",
  FLAT: "text-(--color-text-secondary)",
} as const satisfies Record<ContributionDirection, string>;

/**
 * The Figma "Atribución del rendimiento": what each asset added to the result of the period, from
 * the one that added the most to the one that took the most away. A bar from the middle line (right
 * for a gain, left for a loss) shows the size next to the amount, which carries the figure: the bar
 * and its color are only a picture. It asks for the same period as the rest of the screen, so it
 * loads, fails and retries on its own, and it says why there is nothing to list: the portfolio is
 * empty, or the period has no data.
 */
export function AnalyticsAttributionPanel({
  portfolioId,
  period,
  emptyPortfolio = false,
}: AnalyticsAttributionPanelProps) {
  const { t } = useTranslation();
  const attribution = useAttribution(portfolioId, period);
  const data = attribution.data;
  const rows = data?.status === "OK" ? toAttributionRows(data.groups) : null;

  return (
    <AnalyticsPanel
      busy={attribution.isPlaceholderData}
      subtitle={
        rows !== null && data?.pnl != null
          ? t("analytics.attribution.subtitleTotal", { total: formatSignedMoney(data.pnl) })
          : t("analytics.attribution.subtitle")
      }
      title={t("analytics.attribution.title")}
    >
      {attribution.isError ? (
        <AnalyticsPanelError
          description={t("analytics.attribution.failed.description")}
          onRetry={() => {
            void attribution.refetch();
          }}
          title={t("analytics.attribution.failed.title")}
        />
      ) : attribution.isPending ? (
        <AnalyticsPanelLoading label={t("analytics.attribution.loading")} />
      ) : rows === null ? (
        emptyPortfolio ? (
          <PortfoliosEmptyState
            description={t("analytics.attribution.empty.description")}
            title={t("analytics.attribution.empty.title")}
          />
        ) : (
          <PortfoliosEmptyState
            description={t("analytics.attribution.noRange.description")}
            title={t("analytics.attribution.noRange.title")}
          />
        )
      ) : (
        <Table>
          <caption className="sr-only">{t("analytics.attribution.caption")}</caption>
          <TableHeader>
            <TableRow className="h-10">
              <TableHead>{t("analytics.attribution.columns.asset")}</TableHead>
              <TableHead>{t("analytics.attribution.columns.contribution")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium text-(--color-text-default)">
                  {row.label}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="relative h-2 min-w-16 flex-1">
                      <span className="absolute inset-y-0 left-1/2 w-px bg-(--color-border-default)" />
                      {row.direction === "FLAT" ? null : (
                        <span
                          className={cn(
                            "absolute inset-y-0 rounded-full",
                            row.direction === "GAIN"
                              ? "left-1/2 bg-(--color-chart-gain)"
                              : "right-1/2 bg-(--color-chart-loss)",
                          )}
                          style={{ width: `${String(row.share * 50)}%` }}
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        "w-28 text-right font-medium tabular-nums",
                        AMOUNT_COLORS[row.direction],
                      )}
                    >
                      {formatSignedMoney(row.contribution)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AnalyticsPanel>
  );
}
