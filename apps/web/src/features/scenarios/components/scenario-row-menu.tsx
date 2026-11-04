import { Copy, Ellipsis, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScenarioRow, ScenarioRowActions } from "../types";

interface ScenarioRowMenuProps {
  scenario: ScenarioRow;
  actions: ScenarioRowActions;
}

/**
 * The "⋯" menu at the end of a scenario row, as the Figma draws it: "Duplicar", and "Eliminar" apart
 * and in red. "Abrir" is not offered until there is an editor to open.
 */
export function ScenarioRowMenu({ scenario, actions }: ScenarioRowMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("scenarios.rowMenu.label", { name: scenario.name })}
          size="icon-md"
          variant="ghost"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-53.5">
        <DropdownMenuItem
          onSelect={() => {
            actions.onDuplicate(scenario);
          }}
        >
          <Copy aria-hidden="true" />
          {t("scenarios.rowMenu.duplicate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            actions.onDelete(scenario);
          }}
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
          {t("scenarios.rowMenu.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
