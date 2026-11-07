import { useTranslation } from "react-i18next";
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

interface ResetDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs when the user confirms; the demo resets and the page loads again. */
  onConfirm: () => void;
}

/** Asks before resetting the demo, in the same small dialog as the other confirmations. */
export function ResetDemoDialog({ open, onOpenChange, onConfirm }: ResetDemoDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("shell.resetDemoDialog.title")}</DialogTitle>
          <DialogDescription>{t("shell.resetDemoDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="h-6 p-0" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("shell.resetDemoDialog.cancel")}</Button>
          </DialogClose>
          <Button onClick={onConfirm} variant="destructive">
            {t("shell.resetDemoDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
