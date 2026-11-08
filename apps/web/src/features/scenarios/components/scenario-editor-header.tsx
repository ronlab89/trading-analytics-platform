import { ArrowLeft, Ellipsis, RotateCcw, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { CompareScenariosButton } from "./compare-scenarios-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The way back to the scenarios: the Decision Center on its Scenario Lab tab. */
export const SCENARIOS_PATH = "/decisions?tab=lab";

/** The Figma "Volver a escenarios" button, also what a scenario that cannot be opened offers. */
export function BackToScenarios() {
  const { t } = useTranslation();

  return (
    <Button asChild className="self-start" variant="ghost">
      <Link to={SCENARIOS_PATH}>
        <ArrowLeft aria-hidden="true" />
        {t("scenarios.editor.back")}
      </Link>
    </Button>
  );
}

interface ScenarioEditorHeaderProps {
  portfolioId: string;
  /** The scenario has changes to take back. */
  canReset: boolean;
  onReset: () => void;
  onSave: () => void;
  onDelete: () => void;
  /**
   * On a phone the Figma has the reset at the foot of the variables and a shorter save button, so
   * the header has only what is left.
   */
  compact?: boolean;
}

/**
 * The top of the editor as the Figma draws it: the way back at the start, and at the end the reset,
 * "Guardar escenario" and the menu of more actions.
 */
export function ScenarioEditorHeader({
  portfolioId,
  canReset,
  onReset,
  onSave,
  onDelete,
  compact = false,
}: ScenarioEditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 desktop:flex-row desktop:items-center desktop:justify-between">
      <BackToScenarios />
      <div className="flex flex-wrap items-center gap-2">
        <CompareScenariosButton portfolioId={portfolioId} />
        {compact ? null : (
          <Button disabled={!canReset} onClick={onReset} variant="outline">
            <RotateCcw aria-hidden="true" />
            {t("scenarios.editor.reset")}
          </Button>
        )}
        <Button onClick={onSave}>
          <Save aria-hidden="true" />
          {t(compact ? "scenarios.editor.saveShort" : "scenarios.editor.save")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={t("scenarios.editor.more")} size="icon-md" variant="outline">
              <Ellipsis aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-53.5">
            <DropdownMenuItem onSelect={onDelete} variant="destructive">
              <Trash2 aria-hidden="true" />
              {t("scenarios.editor.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
