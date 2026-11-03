import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { PerformanceChart } from "@/features/dashboard/components/performance-chart";
import { toValueSeries } from "@/features/dashboard/lib/performance-chart-data";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { formatSignedPercent } from "@/lib/format-number";
import { usePeriodPerformance } from "../hooks/use-period-performance";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { periodLabel } from "../lib/period-label";
import { AnalyticsPanel, AnalyticsPanelError, AnalyticsPanelLoading } from "./analytics-panel";

interface AnalyticsValuePanelProps {
  portfolioId: string;
  period: AnalyticsPeriod;
  /** The portfolio has no positions, so there is no value to draw yet. */
  emptyPortfolio?: boolean;
  /** Opens the panel to record a transaction, offered when the portfolio is empty. */
  onNew?: (() => void) | undefined;
  /** Goes back to the last month, offered when the period has no data. */
  onShowLastMonth: () => void;
}

/**
 * The Figma "Valor del portafolio": the value of the portfolio over the chosen period as a line over
 * an area, with the return of the period beside the name of the line. It draws the same chart as the
 * dashboard. The Figma adds an S&P 500 line to compare against; the API has no benchmark, so there
 * is a single line. It says why there is nothing to draw: the portfolio is empty, or the period has
 * no data and a button goes back to the last month.
 */
export function AnalyticsValuePanel({
  portfolioId,
  period,
  emptyPortfolio = false,
  onNew,
  onShowLastMonth,
}: AnalyticsValuePanelProps) {
  const { t, i18n } = useTranslation();
  const performance = usePeriodPerformance(portfolioId, period);
  const series = performance.data?.status === "OK" ? toValueSeries(performance.data.series) : null;
  const twr = performance.data?.twrPercent ?? null;

  return (
    <AnalyticsPanel
      busy={performance.isPlaceholderData}
      subtitle={t("analytics.value.subtitle", {
        currency: series?.currency ?? "",
        period: periodLabel(period, t, i18n.language),
      })}
      title={t("analytics.value.title")}
    >
      {performance.isError ? (
        <AnalyticsPanelError
          description={t("analytics.value.failed.description")}
          onRetry={() => {
            void performance.refetch();
          }}
          title={t("analytics.value.failed.title")}
        />
      ) : performance.isPending ? (
        <AnalyticsPanelLoading label={t("analytics.value.loading")} />
      ) : series === null ? (
        emptyPortfolio ? (
          <PortfoliosEmptyState
            action={
              onNew === undefined ? undefined : (
                <Button onClick={onNew} size="sm">
                  <Plus aria-hidden="true" />
                  {t("transactions.new")}
                </Button>
              )
            }
            description={t("analytics.value.empty.description")}
            title={t("analytics.value.empty.title")}
          />
        ) : (
          <PortfoliosEmptyState
            action={
              <Button onClick={onShowLastMonth} size="sm" variant="outline">
                {t("analytics.value.noRange.action")}
              </Button>
            }
            description={t("analytics.value.noRange.description")}
            title={t("analytics.value.noRange.title")}
          />
        )
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-(--color-text-default)">
            <span aria-hidden="true" className="h-0.5 w-4 bg-(--color-chart-series-1)" />
            {t("analytics.value.legend")}
            {twr === null ? null : <span className="font-medium">{formatSignedPercent(twr)}</span>}
          </p>
          <PerformanceChart series={series} />
        </>
      )}
    </AnalyticsPanel>
  );
}
