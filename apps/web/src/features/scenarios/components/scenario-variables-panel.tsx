import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { AnalyticsPanel } from "@/features/analytics/components/analytics-panel";
import type { ScenarioVariable } from "../lib/scenario-variables";
import { ScenarioVariableControl } from "./scenario-variable-control";

interface ScenarioVariablesPanelProps {
  variables: readonly ScenarioVariable[];
  onChange: (assetId: string, percent: number) => void;
  /** The scenario is still a draft: the Figma says so with an orange "Sin guardar". */
  unsaved: boolean;
}

/**
 * The "Variables" card of the editor: one control for the price of each asset the portfolio holds.
 * Nothing to move, nothing to draw: a portfolio without assets says so.
 */
export function ScenarioVariablesPanel({
  variables,
  onChange,
  unsaved,
}: ScenarioVariablesPanelProps) {
  const { t } = useTranslation();

  return (
    <AnalyticsPanel
      aside={
        unsaved ? <Badge tone="warning">{t("scenarios.editor.variables.unsaved")}</Badge> : null
      }
      subtitle={t("scenarios.editor.variables.description")}
      title={t("scenarios.editor.variables.title")}
    >
      {variables.length === 0 ? (
        <p className="text-sm text-(--color-text-secondary)">
          {t("scenarios.editor.variables.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {variables.map((variable) => (
            <ScenarioVariableControl
              key={variable.assetId}
              onChange={onChange}
              variable={variable}
            />
          ))}
        </div>
      )}
    </AnalyticsPanel>
  );
}
