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

interface LeaveSettingsDialogProps {
  open: boolean;
  /** The user chose to stay: "Seguir editando", the close button or Escape. */
  onKeepEditing: () => void;
  onLeave: () => void;
}

/**
 * The Figma "Salir sin guardar" confirmation of Settings: it warns that what was changed in the
 * card is lost. Closing it any way other than "Salir sin guardar" keeps the form as it was.
 */
export function LeaveSettingsDialog({ open, onKeepEditing, onLeave }: LeaveSettingsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onKeepEditing();
      }}
      open={open}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("settings.leave.title")}</DialogTitle>
          <DialogDescription>{t("settings.leave.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="h-6 p-0" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("settings.leave.keepEditing")}</Button>
          </DialogClose>
          <Button onClick={onLeave} variant="destructive">
            {t("settings.leave.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
