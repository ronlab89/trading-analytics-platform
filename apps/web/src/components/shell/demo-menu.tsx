import { Bell, RotateCcw, SlidersHorizontal, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DemoMenuProps {
  onSimulateConnectionIssue: () => void;
  onSendTestNotification: () => void;
  onResetDemo: () => void;
}

/** The "Demo data" button of the top bar and its menu of demo controls (FE4 wires them). */
export function DemoMenu({
  onSimulateConnectionIssue,
  onSendTestNotification,
  onResetDemo,
}: DemoMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="max-tablet:w-8 max-tablet:border-0 max-tablet:bg-transparent max-tablet:px-0"
          size="sm"
          variant="outline"
        >
          <span className="max-tablet:sr-only">{t("shell.demoData")}</span>
          <SlidersHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-70">
        <DropdownMenuLabel>{t("shell.demoControls")}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onSimulateConnectionIssue}>
          <WifiOff />
          {t("shell.simulateConnectionIssue")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSendTestNotification}>
          <Bell />
          {t("shell.sendTestNotification")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onResetDemo}>
          <RotateCcw />
          {t("shell.resetDemo")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
