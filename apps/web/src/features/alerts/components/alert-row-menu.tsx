import { Ellipsis, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AlertRow } from "../lib/alert-row";

interface AlertRowMenuProps {
  alert: AlertRow;
  onEdit: (alert: AlertRow) => void;
  /** Pauses an enabled alert and resumes a paused one, with no dialog in between. */
  onToggle: (alert: AlertRow) => void;
  onDelete: (alert: AlertRow) => void;
}

/**
 * The "⋯" menu at the end of an alert row: "Edit", "Pause" or "Resume" depending on the alert, and
 * "Delete". The caller decides what each does.
 */
export function AlertRowMenu({ alert, onEdit, onToggle, onDelete }: AlertRowMenuProps) {
  const { t } = useTranslation();
  const ToggleIcon = alert.enabled ? Pause : Play;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("alerts.rowMenu.label", { name: alert.name ?? t("markets.unknownAsset") })}
          size="icon-md"
          variant="ghost"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-53.5">
        <DropdownMenuItem
          onSelect={() => {
            onEdit(alert);
          }}
        >
          <Pencil aria-hidden="true" />
          {t("alerts.rowMenu.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onToggle(alert);
          }}
        >
          <ToggleIcon aria-hidden="true" />
          {t(alert.enabled ? "alerts.rowMenu.pause" : "alerts.rowMenu.resume")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onDelete(alert);
          }}
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
          {t("alerts.rowMenu.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
