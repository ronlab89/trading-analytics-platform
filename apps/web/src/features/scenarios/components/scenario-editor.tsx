import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useScenarioEditor } from "../hooks/use-scenario-editor";
import { DeleteScenarioDialog } from "./delete-scenario-dialog";
import { BackToScenarios, SCENARIOS_PATH, ScenarioEditorHeader } from "./scenario-editor-header";
import { ScenarioEditorSkeleton } from "./scenario-editor-skeleton";
import { ScenarioImpactPanel } from "./scenario-impact-panel";
import { ScenarioVariablesPanel } from "./scenario-variables-panel";
import { SaveScenarioDialog } from "./save-scenario-dialog";

interface ScenarioEditorProps {
  portfolioId: string;
  scenarioId: string;
}

/**
 * The editor of one scenario: the way back and the actions, the variables to move and what moving
 * them does to the portfolio. A scenario that cannot be opened says so, with the way back and a
 * retry; while it loads the two cards are held by blocks.
 */
export function ScenarioEditor({ portfolioId, scenarioId }: ScenarioEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editor = useScenarioEditor(portfolioId, scenarioId);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (editor.isError) {
    return (
      <>
        <BackToScenarios />
        <Alert
          action={
            <Button onClick={editor.reload} size="sm" variant="outline">
              {t("scenarios.editor.failed.retry")}
            </Button>
          }
          description={t("scenarios.editor.failed.description")}
          title={t("scenarios.editor.failed.title")}
          tone="error"
        />
      </>
    );
  }

  const { scenario } = editor;
  if (editor.isPending || scenario === undefined) return <ScenarioEditorSkeleton />;

  return (
    <>
      <ScenarioEditorHeader
        canReset={editor.variables.some(({ percent }) => percent !== 0)}
        onDelete={() => {
          setDeleting(true);
        }}
        onReset={editor.reset}
        onSave={() => {
          setSaving(true);
        }}
      />
      <div className="grid items-start gap-4 desktop:grid-cols-[minmax(0,408fr)_minmax(0,912fr)] desktop:gap-6">
        <ScenarioVariablesPanel
          onChange={editor.setPercent}
          unsaved={scenario.status === "DRAFT"}
          variables={editor.variables}
        />
        <ScenarioImpactPanel
          calculation={editor.impact.data}
          failed={editor.failed}
          onRetry={editor.retry}
          recalculating={editor.recalculating}
        />
      </div>
      <SaveScenarioDialog
        onOpenChange={setSaving}
        open={saving}
        portfolioId={portfolioId}
        scenario={scenario}
      />
      <DeleteScenarioDialog
        onDeleted={() => {
          void navigate(SCENARIOS_PATH);
        }}
        onOpenChange={setDeleting}
        open={deleting}
        portfolioId={portfolioId}
        scenario={scenario}
      />
    </>
  );
}
