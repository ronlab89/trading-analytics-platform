import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { type PerformancePeriod, usePerformance } from "../hooks/use-performance";
import { toValueSeries } from "../lib/performance-chart-data";
import { PerformanceChart } from "./performance-chart";
import { PerformancePeriodTabs } from "./performance-period-tabs";

interface PerformancePanelProps {
  portfolioId: string;
}

/**
 * The Figma "Rendimiento" panel: the value of the portfolio over a period the user picks. It asks
 * for its own data, so it loads, fails and retries on its own without taking the rest of the
 * dashboard with it. The Figma also draws an S&P 500 line to compare against; the API has no
 * benchmark yet, so there is a single line.
 */
export function PerformancePanel({ portfolioId }: PerformancePanelProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<PerformancePeriod>("1M");
  const performance = usePerformance(portfolioId, period);
  const series = performance.data?.status === "OK" ? toValueSeries(performance.data.series) : null;

  return (
    <section
      aria-busy={performance.isPlaceholderData}
      aria-labelledby="dashboard-performance-title"
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-lg leading-6 font-medium text-(--color-text-default)"
          id="dashboard-performance-title"
        >
          {t("dashboard.performance.title")}
        </h2>
        <PerformancePeriodTabs onChange={setPeriod} value={period} />
      </div>
      {performance.isError ? (
        <Alert
          action={
            <Button
              onClick={() => {
                void performance.refetch();
              }}
              size="sm"
              variant="outline"
            >
              {t("dashboard.performance.failed.retry")}
            </Button>
          }
          description={t("dashboard.performance.failed.description")}
          title={t("dashboard.performance.failed.title")}
          tone="error"
        />
      ) : performance.isPending ? (
        <div aria-label={t("dashboard.performance.loading")} role="status">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : series === null ? (
        <PortfoliosEmptyState
          description={t("dashboard.performance.empty.description")}
          title={t("dashboard.performance.empty.title")}
        />
      ) : (
        <PerformanceChart series={series} />
      )}
    </section>
  );
}
