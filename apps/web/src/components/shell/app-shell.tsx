import { Outlet, useMatch } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { userInitials } from "@/features/auth/lib/user-initials";
import { usePortfolio } from "@/features/portfolios/hooks/use-portfolio";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useCurrentUser } from "@/hooks/use-session";
import { portfolioInitials } from "@/lib/portfolio-initials";
import { ActivityBar } from "./activity-bar";
import { BottomTabBar } from "./bottom-tab-bar";
import { StatusBar } from "./status-bar";
import { TopBar } from "./top-bar";

/**
 * The frame of every view: floating panels (activity bar, status bar) with 8 px around them
 * and between them, and the routed view scrolling in the middle, as in the Figma layout. The user
 * and the portfolios are the real ones; the status values are fixed samples until the real-time
 * connection (FE3) provides the real ones.
 */
export function AppShell() {
  const portfolio = useActivePortfolio();
  const portfolioOptions = portfolio.portfolios.map(({ id, name, baseCurrency }) => ({
    id,
    name,
    currency: baseCurrency,
    initials: portfolioInitials(name),
  }));
  // The routes put the shell behind `RequireAuth`, so there is a user; the fallback is for tests.
  const userName = useCurrentUser()?.displayName ?? "";
  const initials = userInitials(userName);
  const signOut = useSignOut();
  // The detail page reads the same query, so the name in the breadcrumb costs no extra request.
  const detailId = useMatch("/portfolios/:portfolioId")?.params.portfolioId;
  const detailName = usePortfolio(detailId).data?.name;

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col tablet:flex-row tablet:gap-2 tablet:p-2">
        <ActivityBar
          userInitials={initials}
          userName={userName}
          onSignOut={signOut}
          onViewProfile={() => undefined}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col tablet:gap-2">
          <TopBar
            onOpenNotifications={() => undefined}
            onResetDemo={() => undefined}
            onRetryPortfolios={portfolio.retry}
            onSelectPortfolio={portfolio.select}
            onSendTestNotification={() => undefined}
            onSignOut={signOut}
            onSimulateConnectionIssue={() => undefined}
            onViewProfile={() => undefined}
            pageTitle={detailName}
            portfolios={portfolioOptions}
            portfoliosFailed={portfolio.isError}
            portfoliosLoading={portfolio.isPending}
            selectedPortfolioId={portfolio.active?.id}
            unread={{ kind: "count", count: 3 }}
            userInitials={initials}
            userName={userName}
          />
          <main className="relative min-h-0 flex-1 overflow-y-auto p-4 tablet:pt-2 tablet:pr-4 tablet:pb-4 tablet:pl-2">
            <Outlet />
          </main>
          <StatusBar
            alertCount={1}
            calculation={{ kind: "upToDate", time: "14:32:07" }}
            connection="live"
            lastSync={{ kind: "syncedAgo", seconds: 3 }}
          />
          <BottomTabBar />
        </div>
      </div>
    </TooltipProvider>
  );
}
