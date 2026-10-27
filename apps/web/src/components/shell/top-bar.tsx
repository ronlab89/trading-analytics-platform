import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { Logo } from "@/components/logo";
import { Breadcrumb, BreadcrumbItem } from "@/components/breadcrumb";
import { DemoMenu } from "./demo-menu";
import { activeDestinationPath, DESTINATIONS, SETTINGS_DESTINATION } from "./destinations";
import { NotificationButton, type Unread } from "./notification-button";
import { PortfolioSelector, type PortfolioOption } from "./portfolio-selector";
import { UserMenu } from "./user-menu";

interface TopBarProps {
  portfolios: readonly PortfolioOption[];
  selectedPortfolioId: string;
  unread: Unread;
  userName: string;
  userInitials: string;
  onSelectPortfolio: (id: string) => void;
  onOpenNotifications: () => void;
  onSimulateConnectionIssue: () => void;
  onSendTestNotification: () => void;
  onResetDemo: () => void;
  onViewProfile: () => void;
  onSignOut: () => void;
}

/**
 * The bar above every view: portfolio, where you are, demo controls and notifications. On mobile it
 * trades the breadcrumb for the logo and the user menu, which the activity bar holds elsewhere.
 */
export function TopBar({
  portfolios,
  selectedPortfolioId,
  unread,
  userName,
  userInitials,
  onSelectPortfolio,
  onOpenNotifications,
  onSimulateConnectionIssue,
  onSendTestNotification,
  onResetDemo,
  onViewProfile,
  onSignOut,
}: TopBarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = [...DESTINATIONS, SETTINGS_DESTINATION].find(
    ({ path }) => path === activeDestinationPath(pathname),
  );

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-2.5 md:h-11 md:rounded-md md:border md:py-0 md:pr-3 md:pl-2">
      <div className="flex min-w-0 items-center gap-2">
        <Logo className="shrink-0 md:hidden" />
        <PortfolioSelector
          onSelect={onSelectPortfolio}
          portfolios={portfolios}
          selectedId={selectedPortfolioId}
        />
        <div className="flex items-center gap-2 max-md:hidden">
          <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <Breadcrumb label={t("shell.breadcrumb")}>
            <BreadcrumbItem>{current ? t(current.labelKey) : null}</BreadcrumbItem>
          </Breadcrumb>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DemoMenu
          onResetDemo={onResetDemo}
          onSendTestNotification={onSendTestNotification}
          onSimulateConnectionIssue={onSimulateConnectionIssue}
        />
        <NotificationButton onClick={onOpenNotifications} unread={unread} />
        <div className="md:hidden">
          <UserMenu
            initials={userInitials}
            name={userName}
            onSignOut={onSignOut}
            onViewProfile={onViewProfile}
            side="bottom"
          />
        </div>
      </div>
    </header>
  );
}
