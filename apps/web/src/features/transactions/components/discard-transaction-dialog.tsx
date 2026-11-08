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

interface DiscardTransactionDialogProps {
  open: boolean;
  /** The user chose to stay, with "Seguir editando", the close button or Escape. */
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/**
 * The Figma "Salir sin guardar" confirmation over the new transaction panel. Closing it any way
 * other than "Salir sin guardar" keeps the form as it was.
 */
export function DiscardTransactionDialog({
  open,
  onKeepEditing,
  onDiscard,
}: DiscardTransactionDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onKeepEditing();
        }
      }}
      open={open}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("transactionForm.discard.title")}</DialogTitle>
          <DialogDescription>{t("transactionForm.discard.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="h-6 p-0" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("transactionForm.discard.keepEditing")}</Button>
          </DialogClose>
          <Button onClick={onDiscard} variant="destructive">
            {t("transactionForm.discard.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
