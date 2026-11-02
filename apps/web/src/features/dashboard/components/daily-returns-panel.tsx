import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { usePerformance } from "../hooks/use-performance";
import { dailyStats, lastReturns } from "../lib/performance-stats";
import { DailyReturnsChart } from "./daily-returns-chart";
import { DailyStats } from "./daily-stats";

interface DailyReturnsPanelProps {
  portfolioId: string;
}

/** How many days the Figma "Rendimiento diario" draws: the last 30 business days. */
const WINDOW_DAYS = 30;

/**
 * The Figma "Rendimiento diario" panel: a bar for each of the latest days and five figures under
 * them. It asks for three months, which always holds the 30 days it draws, and shares that request
 * with nothing else, so it loads, fails and retries on its own.
 */
export function DailyReturnsPanel({ portfolioId }: DailyReturnsPanelProps) {
  const { t } = useTranslation();
  const performance = usePerformance(portfolioId, "3M");
  const recent =
    performance.data?.status === "OK" ? lastReturns(performance.data.series, WINDOW_DAYS) : [];
  const days = recent.flatMap(({ date, returnPercent }) =>
    returnPercent === null ? [] : [{ date, percent: returnPercent }],
  );
  const stats = dailyStats(recent);

  return (
    <section
      aria-labelledby="dashboard-daily-returns-title"
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="text-lg leading-6 font-medium text-(--color-text-default)"
          id="dashboard-daily-returns-title"
        >
          {t("dashboard.dailyReturns.title")}
        </h2>
        <p className="text-xs text-(--color-text-secondary)">
          {t("dashboard.dailyReturns.subtitle")}
        </p>
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
              {t("dashboard.dailyReturns.failed.retry")}
            </Button>
          }
          description={t("dashboard.dailyReturns.failed.description")}
          title={t("dashboard.dailyReturns.failed.title")}
          tone="error"
        />
      ) : performance.isPending ? (
        <div aria-label={t("dashboard.dailyReturns.loading")} role="status">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : stats === null || days.length === 0 ? (
        <PortfoliosEmptyState
          description={t("dashboard.dailyReturns.empty.description")}
          title={t("dashboard.dailyReturns.empty.title")}
        />
      ) : (
        <>
          <DailyReturnsChart days={days} stats={stats} />
          <DailyStats stats={stats} />
        </>
      )}
    </section>
  );
}
