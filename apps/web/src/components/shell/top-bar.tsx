import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { Breadcrumb, BreadcrumbItem } from "@/components/breadcrumb";
import { DemoMenu } from "./demo-menu";
import { activeDestinationPath, DESTINATIONS, SETTINGS_DESTINATION } from "./destinations";
import { NotificationButton, type Unread } from "./notification-button";
import { PortfolioSelector, type PortfolioOption } from "./portfolio-selector";

interface TopBarProps {
  portfolios: readonly PortfolioOption[];
  selectedPortfolioId: string;
  unread: Unread;
  onSelectPortfolio: (id: string) => void;
  onOpenNotifications: () => void;
  onSimulateConnectionIssue: () => void;
  onSendTestNotification: () => void;
  onResetDemo: () => void;
}

/** The 44 px bar above every view: portfolio, where you are, demo controls and notifications. */
export function TopBar({
  portfolios,
  selectedPortfolioId,
  unread,
  onSelectPortfolio,
  onOpenNotifications,
  onSimulateConnectionIssue,
  onSendTestNotification,
  onResetDemo,
}: TopBarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = [...DESTINATIONS, SETTINGS_DESTINATION].find(
    ({ path }) => path === activeDestinationPath(pathname),
  );

  return (
    <header className="flex h-11 shrink-0 items-center justify-between rounded-md border bg-card pr-3 pl-2">
      <div className="flex items-center gap-2">
        <PortfolioSelector
          onSelect={onSelectPortfolio}
          portfolios={portfolios}
          selectedId={selectedPortfolioId}
        />
        <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <Breadcrumb label={t("shell.breadcrumb")}>
          <BreadcrumbItem>{current ? t(current.labelKey) : null}</BreadcrumbItem>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2">
        <DemoMenu
          onResetDemo={onResetDemo}
          onSendTestNotification={onSendTestNotification}
          onSimulateConnectionIssue={onSimulateConnectionIssue}
        />
        <NotificationButton onClick={onOpenNotifications} unread={unread} />
      </div>
    </header>
  );
}
