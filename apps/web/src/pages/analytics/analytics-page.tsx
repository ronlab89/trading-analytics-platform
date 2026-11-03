import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AnalyticsKpis } from "@/features/analytics/components/analytics-kpis";
import { AnalyticsPeriodSelector } from "@/features/analytics/components/analytics-period-selector";
import {
  DEFAULT_ANALYTICS_PERIOD,
  type AnalyticsPeriod,
} from "@/features/analytics/lib/analytics-period";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { usePositions } from "@/features/portfolios/hooks/use-positions";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useIsMobile } from "@/hooks/use-media-query";

/**
 * The Analytics screen: the indicators of the active portfolio over a period the user chooses. The
 * portfolio is the `key` of the content, so choosing another one starts from its own state and the
 * period. Without a portfolio there is nothing to measure, so the page says so, as the dashboard does.
 */
export function AnalyticsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { active, isPending, isError, retry } = useActivePortfolio();

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <h1
        className={
          isMobile ? "text-2xl leading-8 font-semibold text-(--color-text-default)" : "sr-only"
        }
      >
        {t("nav.analytics")}
      </h1>
      {active !== undefined ? (
        <Analytics key={active.id} portfolioId={active.id} portfolioName={active.name} />
      ) : isError ? (
        <Alert
          action={
            <Button onClick={retry} size="sm" variant="outline">
              {t("analytics.failed.retry")}
            </Button>
          }
          description={t("analytics.failed.description")}
          title={t("analytics.failed.title")}
          tone="error"
        />
      ) : isPending ? null : (
        <section className="rounded-xl bg-(--color-surface-card) p-6">
          <PortfoliosEmptyState
            description={t("portfolios.empty.description")}
            title={t("portfolios.empty.title")}
          />
        </section>
      )}
    </div>
  );
}

interface AnalyticsProps {
  portfolioId: string;
  portfolioName: string;
}

function Analytics({ portfolioId, portfolioName }: AnalyticsProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_ANALYTICS_PERIOD);
  const positions = usePositions(portfolioId);
  const positionCount = positions.data?.length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isMobile ? null : (
          <p className="text-sm text-(--color-text-secondary)">
            {positionCount === undefined
              ? portfolioName
              : t("analytics.header.summary", { portfolio: portfolioName, count: positionCount })}
          </p>
        )}
        <AnalyticsPeriodSelector onChange={setPeriod} value={period} />
      </div>
      <AnalyticsKpis
        emptyPortfolio={positionCount === 0}
        period={period}
        portfolioId={portfolioId}
        portfolioName={portfolioName}
      />
    </>
  );
}
