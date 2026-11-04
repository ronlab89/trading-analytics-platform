import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { rejectionReason } from "@/api/rejection-reason";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteScenario } from "../hooks/use-delete-scenario";
import type { ScenarioRow } from "../types";

interface DeleteScenarioDialogProps {
  portfolioId: string;
  /** The scenario to delete; the dialog renders nothing without one. */
  scenario: ScenarioRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Asks before deleting a scenario, in the same small dialog as the other confirmations: deleting
 * cannot be undone, and it says that the real portfolio is not touched. Confirming locks the dialog
 * until the API answers; a success closes it with the Figma "Escenario eliminado" notice, a failure
 * keeps it open with the reason when the API gives one.
 */
export function DeleteScenarioDialog({
  portfolioId,
  scenario,
  open,
  onOpenChange,
}: DeleteScenarioDialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteScenario(portfolioId);

  const deleteScenario = () => {
    if (!scenario) {
      return;
    }
    remove.mutate(scenario.id, {
      onSuccess: () => {
        toast.success(t("scenarios.delete.done.title"), {
          description: t("scenarios.delete.done.description", { name: scenario.name }),
        });
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(t("scenarios.delete.failed.title"), {
          description: rejectionReason(error) ?? t("scenarios.delete.failed.description"),
        });
      },
    });
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!remove.isPending) {
          onOpenChange(next);
        }
      }}
      open={open && scenario !== null}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("scenarios.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("scenarios.delete.description", { name: scenario?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="h-6 p-0" />
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={remove.isPending} variant="outline">
              {t("scenarios.delete.cancel")}
            </Button>
          </DialogClose>
          <Button loading={remove.isPending} onClick={deleteScenario} variant="destructive">
            {remove.isPending ? t("scenarios.delete.deleting") : t("scenarios.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
