import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { rejectionReason } from "@/api/rejection-reason";
import type { ScenarioRow, ScenarioRowActions } from "../types";
import { useDuplicateScenario } from "./use-duplicate-scenario";

/**
 * What the menu of a scenario row does. Duplicating runs at once and says how it went with a
 * notice; deleting only picks the scenario, because the confirmation is the dialog's: `deleting` is
 * the scenario it asks about, and `cancelDelete` closes it. The actions are the same object between
 * renders, which the columns need to stay stable.
 */
export function useScenarioActions(portfolioId: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const duplicate = useDuplicateScenario(portfolioId);
  const [deleting, setDeleting] = useState<ScenarioRow | null>(null);
  const { mutate: duplicateScenario } = duplicate;

  const actions = useMemo<ScenarioRowActions>(
    () => ({
      onOpen: (scenario) => {
        void navigate(`/decisions/lab/${scenario.id}`);
      },
      onDuplicate: (scenario) => {
        duplicateScenario(
          {
            scenarioId: scenario.id,
            name: t("scenarios.duplicate.copyName", { name: scenario.name }),
          },
          {
            onSuccess: (copy) => {
              toast.success(t("scenarios.duplicate.done.title"), {
                description: t("scenarios.duplicate.done.description", { name: copy.name }),
              });
            },
            onError: (error) => {
              toast.error(t("scenarios.duplicate.failed.title"), {
                description: rejectionReason(error) ?? t("scenarios.duplicate.failed.description"),
              });
            },
          },
        );
      },
      onDelete: setDeleting,
    }),
    [duplicateScenario, navigate, t],
  );

  return {
    actions,
    deleting,
    cancelDelete: () => {
      setDeleting(null);
    },
  };
}
