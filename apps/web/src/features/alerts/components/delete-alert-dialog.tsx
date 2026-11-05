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
import { useDeleteAlert } from "../hooks/use-delete-alert";
import type { AlertRow } from "../lib/alert-row";

interface DeleteAlertDialogProps {
  /** The alert to delete; the dialog renders nothing without one. */
  alert: AlertRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Asks before deleting an alert, in the same small dialog as the other confirmations: deleting
 * cannot be undone. Confirming locks the dialog until the API answers; a success closes it with a
 * notice, a failure keeps it open and says why.
 */
export function DeleteAlertDialog({ alert, open, onOpenChange }: DeleteAlertDialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteAlert();

  const deleteAlert = () => {
    if (!alert) return;
    remove.mutate(alert.id, {
      onSuccess: () => {
        toast.success(t("alerts.delete.done"));
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(t("alerts.delete.failed.title"), {
          description: rejectionReason(error) ?? t("alerts.delete.failed.description"),
        });
      },
    });
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!remove.isPending) onOpenChange(next);
      }}
      open={open && alert !== null}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("alerts.delete.title")}</DialogTitle>
          <DialogDescription>{t("alerts.delete.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="h-6 p-0" />
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={remove.isPending} variant="outline">
              {t("alerts.form.cancel")}
            </Button>
          </DialogClose>
          <Button loading={remove.isPending} onClick={deleteAlert} variant="destructive">
            {remove.isPending ? t("alerts.delete.deleting") : t("alerts.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
