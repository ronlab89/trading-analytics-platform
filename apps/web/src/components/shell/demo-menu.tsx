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
        <Button size="sm" variant="outline">
          {t("shell.demoData")}
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
