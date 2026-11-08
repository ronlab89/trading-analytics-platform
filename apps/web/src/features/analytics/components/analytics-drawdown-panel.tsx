import { useTranslation } from "react-i18next";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { formatDayMonth } from "@/lib/format-date";
import { formatPercent } from "@/lib/format-number";
import { usePeriodPerformance } from "../hooks/use-period-performance";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { summarizeDrawdown, toDrawdownSeries } from "../lib/drawdown-series";
import { AnalyticsPanel, AnalyticsPanelError, AnalyticsPanelLoading } from "./analytics-panel";
import { DrawdownChart } from "./drawdown-chart";

interface AnalyticsDrawdownPanelProps {
  portfolioId: string;
  period: AnalyticsPeriod;
  /** The portfolio has no positions, so there is no drawdown to draw yet. */
  emptyPortfolio?: boolean;
}

/**
 * The Figma "Drawdown": the fall from the previous high over the chosen period, worked out from the
 * daily returns of the performance series. The line under the title says how deep the fall was and
 * when. It asks for the same data as the other panels, so it loads, fails and retries on its own,
 * and it says why there is nothing to draw: the portfolio is empty, or the period has no data.
 */
export function AnalyticsDrawdownPanel({
  portfolioId,
  period,
  emptyPortfolio = false,
}: AnalyticsDrawdownPanelProps) {
  const { t, i18n } = useTranslation();
  const performance = usePeriodPerformance(portfolioId, period);
  const points =
    performance.data?.status === "OK" ? toDrawdownSeries(performance.data.series) : null;
  const deepest = points === null ? null : summarizeDrawdown(points).deepest;

  return (
    <AnalyticsPanel
      busy={performance.isPlaceholderData}
      subtitle={
        deepest !== null && deepest.drawdown < 0
          ? t("analytics.drawdown.subtitleDeepest", {
              value: formatPercent(deepest.drawdown),
              date: formatDayMonth(deepest.date, i18n.language),
            })
          : t("analytics.drawdown.subtitle")
      }
      title={t("analytics.drawdown.title")}
    >
      {performance.isError ? (
        <AnalyticsPanelError
          description={t("analytics.drawdown.failed.description")}
          onRetry={() => {
            void performance.refetch();
          }}
          title={t("analytics.drawdown.failed.title")}
        />
      ) : performance.isPending ? (
        <AnalyticsPanelLoading label={t("analytics.drawdown.loading")} />
      ) : points === null ? (
        emptyPortfolio ? (
          <PortfoliosEmptyState
            description={t("analytics.drawdown.empty.description")}
            title={t("analytics.drawdown.empty.title")}
          />
        ) : (
          <PortfoliosEmptyState
            description={t("analytics.drawdown.noRange.description")}
            title={t("analytics.drawdown.noRange.title")}
          />
        )
      ) : (
        <DrawdownChart points={points} />
      )}
    </AnalyticsPanel>
  );
}
