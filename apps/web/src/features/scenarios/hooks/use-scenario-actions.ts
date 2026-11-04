import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { rejectionReason } from "@/api/rejection-reason";
import type { ScenarioRow, ScenarioRowActions } from "../types";
import { useCreateScenario } from "./use-create-scenario";
import { useDuplicateScenario } from "./use-duplicate-scenario";

/**
 * What the menu of a scenario row does. Duplicating runs at once and says how it went with a
 * notice; deleting only picks the scenario, because the confirmation is the dialog's: `deleting` is
 * the scenario it asks about, and `cancelDelete` closes it. The actions are the same object between
 * renders, which the columns need to stay stable. `create` makes a draft with a default name and
 * opens it in the editor; `creating` is true while it is on its way.
 */
export function useScenarioActions(portfolioId: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const duplicate = useDuplicateScenario(portfolioId);
  const creation = useCreateScenario(portfolioId);
  const [deleting, setDeleting] = useState<ScenarioRow | null>(null);
  const { mutate: duplicateScenario } = duplicate;
  const { mutate: createScenario } = creation;

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

  const create = useCallback(() => {
    createScenario(t("scenarios.new.name"), {
      onSuccess: (scenario) => {
        void navigate(`/decisions/lab/${scenario.id}`);
      },
      onError: (error) => {
        toast.error(t("scenarios.new.failed.title"), {
          description: rejectionReason(error) ?? t("scenarios.new.failed.description"),
        });
      },
    });
  }, [createScenario, navigate, t]);

  return {
    actions,
    create,
    creating: creation.isPending,
    deleting,
    cancelDelete: () => {
      setDeleting(null);
    },
  };
}
