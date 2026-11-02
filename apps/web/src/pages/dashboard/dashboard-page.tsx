import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DailyReturnsPanel } from "@/features/dashboard/components/daily-returns-panel";
import { MonthlyReturns } from "@/features/dashboard/components/monthly-returns";
import { PerformancePanel } from "@/features/dashboard/components/performance-panel";
import { PortfolioValuePanel } from "@/features/dashboard/components/portfolio-value-panel";
import { RecentTransactionsPanel } from "@/features/dashboard/components/recent-transactions-panel";
import { TotalReturnPanel } from "@/features/dashboard/components/total-return-panel";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";
import { useOverview } from "@/features/dashboard/hooks/use-overview";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { toTransactionRow } from "@/features/transactions/lib/transaction-row";
import { NewTransactionPanel } from "@/features/transactions/components/new-transaction-panel";
import { useAnnounceRecorded } from "@/features/transactions/hooks/use-announce-recorded";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useIsMobile } from "@/hooks/use-media-query";
import { useCurrentUser } from "@/hooks/use-session";

/**
 * The home screen: the dashboard of the active portfolio. The portfolio is the `key` of the
 * dashboard, so choosing another one starts from its own loading state. Without a portfolio there
 * is nothing to draw, so the page says so, as the portfolios list does.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const { active, isPending, isError, retry } = useActivePortfolio();

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <h1 className="sr-only">{t("nav.home")}</h1>
      {active !== undefined ? (
        <Dashboard key={active.id} portfolioId={active.id} portfolioName={active.name} />
      ) : isError ? (
        <Alert
          action={
            <Button onClick={retry} size="sm" variant="outline">
              {t("dashboard.failed.retry")}
            </Button>
          }
          description={t("dashboard.failed.description")}
          title={t("dashboard.failed.title")}
          tone="error"
        />
      ) : isPending ? (
        <DashboardSkeleton />
      ) : (
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

interface DashboardProps {
  portfolioId: string;
  portfolioName: string;
}

function Dashboard({ portfolioId, portfolioName }: DashboardProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const overview = useOverview(portfolioId);
  const [panelOpen, setPanelOpen] = useState(false);
  const announceRecorded = useAnnounceRecorded();
  const firstName = useCurrentUser()?.displayName.trim().split(/\s+/)[0] ?? "";
  // Taken once, so the header does not change its day under the user's eyes.
  const [today] = useState(() => new Date().toISOString());

  if (overview.isError) {
    return (
      <Alert
        action={
          <Button
            onClick={() => {
              void overview.refetch();
            }}
            size="sm"
            variant="outline"
          >
            {t("dashboard.failed.retry")}
          </Button>
        }
        description={t("dashboard.failed.description")}
        title={t("dashboard.failed.title")}
        tone="error"
      />
    );
  }

  if (overview.data === undefined) {
    return <DashboardSkeleton />;
  }

  const { positions, summary, dailyChange, recentTransactions } = overview.data;
  const recentRows = recentTransactions.map(({ transaction, asset }) =>
    toTransactionRow(transaction, asset ?? undefined),
  );
  const empty = positions.length === 0;
  const openPanel = () => {
    setPanelOpen(true);
  };

  return (
    <>
      {isMobile ? null : (
        <DashboardHeader
          action={
            empty ? (
              <Button onClick={openPanel}>
                <Plus aria-hidden="true" />
                {t("transactions.new")}
              </Button>
            ) : null
          }
          portfolioName={portfolioName}
          positionCount={positions.length}
          today={today}
          updatedAt={overview.dataUpdatedAt}
        />
      )}
      <div className="grid gap-4 desktop:grid-cols-2 desktop:gap-6">
        <PortfolioValuePanel
          dailyChange={dailyChange}
          empty={empty}
          firstName={firstName}
          onNew={openPanel}
          portfolioId={portfolioId}
          totalValue={summary.totalValue}
        >
          <MonthlyReturns portfolioId={portfolioId} />
        </PortfolioValuePanel>
        {empty ? null : <PerformancePanel portfolioId={portfolioId} />}
        <TotalReturnPanel
          empty={empty}
          percent={summary.unrealizedPnLPercent}
          profit={summary.unrealizedPnL}
        />
        {empty ? null : <DailyReturnsPanel portfolioId={portfolioId} />}
        <div className="desktop:col-span-2">
          <RecentTransactionsPanel onNew={openPanel} rows={recentRows} />
        </div>
      </div>
      <NewTransactionPanel
        onOpenChange={setPanelOpen}
        onRecorded={announceRecorded}
        open={panelOpen}
        portfolioId={portfolioId}
      />
    </>
  );
}
