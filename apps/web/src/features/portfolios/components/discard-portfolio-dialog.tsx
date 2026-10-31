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

interface DiscardPortfolioDialogProps {
  open: boolean;
  /** The user chose to stay, with "Seguir editando", the close button or Escape. */
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/**
 * The Figma "Crear · Salir sin guardar" confirmation: a small dialog over the form that warns the
 * portfolio being created will be lost. Closing it any way other than "Salir sin guardar" keeps the
 * form as it was.
 */
export function DiscardPortfolioDialog({
  open,
  onKeepEditing,
  onDiscard,
}: DiscardPortfolioDialogProps) {
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
          <DialogTitle>{t("portfolioForm.discard.title")}</DialogTitle>
          <DialogDescription>{t("portfolioForm.discard.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="h-6 p-0" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("portfolioForm.discard.keepEditing")}</Button>
          </DialogClose>
          <Button onClick={onDiscard} variant="destructive">
            {t("portfolioForm.discard.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
