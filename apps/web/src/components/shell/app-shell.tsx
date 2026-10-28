import { useState } from "react";
import { Outlet } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { userInitials } from "@/features/auth/lib/user-initials";
import { useCurrentUser } from "@/hooks/use-session";
import { ActivityBar } from "./activity-bar";
import { BottomTabBar } from "./bottom-tab-bar";
import type { PortfolioOption } from "./portfolio-selector";
import { StatusBar } from "./status-bar";
import { TopBar } from "./top-bar";

const SAMPLE_PORTFOLIOS: readonly PortfolioOption[] = [
  { id: "growth", name: "Crecimiento", currency: "USD", initials: "CR" },
  { id: "conservative", name: "Conservador", currency: "USD", initials: "CO" },
  { id: "dividends", name: "Dividendos", currency: "USD", initials: "DI" },
];

/**
 * The frame of every view: floating panels (activity bar, status bar) with 8 px around them
 * and between them, and the routed view scrolling in the middle, as in the Figma layout. The user
 * is the signed-in one; the portfolios and the status values are fixed samples until FE1 and the
 * real-time connection (FE3) provide the real ones.
 */
export function AppShell() {
  const [portfolioId, setPortfolioId] = useState("growth");
  // The routes put the shell behind `RequireAuth`, so there is a user; the fallback is for tests.
  const userName = useCurrentUser()?.displayName ?? "";
  const initials = userInitials(userName);

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col tablet:flex-row tablet:gap-2 tablet:p-2">
        <ActivityBar
          userInitials={initials}
          userName={userName}
          onSignOut={() => undefined}
          onViewProfile={() => undefined}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col tablet:gap-2">
          <TopBar
            onOpenNotifications={() => undefined}
            onResetDemo={() => undefined}
            onSelectPortfolio={setPortfolioId}
            onSendTestNotification={() => undefined}
            onSignOut={() => undefined}
            onSimulateConnectionIssue={() => undefined}
            onViewProfile={() => undefined}
            portfolios={SAMPLE_PORTFOLIOS}
            selectedPortfolioId={portfolioId}
            unread={{ kind: "count", count: 3 }}
            userInitials={initials}
            userName={userName}
          />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 tablet:px-6 tablet:pt-2 tablet:pb-4 desktop:pr-4 desktop:pl-2">
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
