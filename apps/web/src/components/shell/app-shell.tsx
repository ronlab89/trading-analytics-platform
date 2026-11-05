import { Outlet, useMatch, useNavigate } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { userInitials } from "@/features/auth/lib/user-initials";
import { useNotificationUpdates } from "@/features/notifications/hooks/use-notification-updates";
import { useUnreadNotifications } from "@/features/notifications/hooks/use-unread-notifications";
import { useSavedMotion } from "@/features/settings/hooks/use-saved-motion";
import { useSavedLanguage } from "@/features/settings/hooks/use-saved-language";
import { usePortfolio } from "@/features/portfolios/hooks/use-portfolio";
import { usePortfolioUpdates } from "@/features/portfolios/hooks/use-portfolio-updates";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useCurrentUser } from "@/hooks/use-session";
import { portfolioInitials } from "@/lib/portfolio-initials";
import { ActivityBar } from "./activity-bar";
import { PROFILE_PATH } from "./destinations";
import { BottomTabBar } from "./bottom-tab-bar";
import { ConnectedStatusBar } from "./connected-status-bar";
import { TopBar } from "./top-bar";

/**
 * The frame of every view: floating panels (activity bar, status bar) with 8 px around them
 * and between them, and the routed view scrolling in the middle, as in the Figma layout. The user
 * and the portfolios are the real ones, and so is the connection in the status bar; the alert count
 * and the time of the last calculation are fixed samples until their own features provide them.
 */
export function AppShell() {
  useSavedLanguage();
  useSavedMotion();
  const portfolio = useActivePortfolio();
  // Whatever view works on the active portfolio reads it again when the server says it changed.
  usePortfolioUpdates(portfolio.active?.id);
  const notifications = useUnreadNotifications();
  // A new notification moves the count and, when it warns or fails, tells the user.
  useNotificationUpdates();
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
  const navigate = useNavigate();
  const viewProfile = () => {
    void navigate(PROFILE_PATH);
  };
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
          onViewProfile={viewProfile}
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
            onViewProfile={viewProfile}
            pageTitle={detailName}
            portfolios={portfolioOptions}
            portfoliosFailed={portfolio.isError}
            portfoliosLoading={portfolio.isPending}
            selectedPortfolioId={portfolio.active?.id}
            unread={notifications.unread}
            userInitials={initials}
            userName={userName}
          />
          <main className="relative min-h-0 flex-1 overflow-y-auto p-4 tablet:pt-2 tablet:pr-4 tablet:pb-4 tablet:pl-2">
            <Outlet />
          </main>
          <ConnectedStatusBar alertCount={notifications.alerts} calculationTime="14:32:07" />
          <BottomTabBar />
        </div>
      </div>
    </TooltipProvider>
  );
}
