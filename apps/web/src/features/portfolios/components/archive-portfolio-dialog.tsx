import type { PortfolioResponse } from "@trading/contracts";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { useArchivePortfolio } from "../hooks/use-archive-portfolio";

interface ArchivePortfolioDialogProps {
  /** The portfolio to archive; the dialog renders nothing without one. */
  portfolio: PortfolioResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Asks before archiving a portfolio, in the same small dialog as "¿Salir sin guardar?": archiving
 * cannot be undone, as the API has no unarchive. Confirming locks the dialog until the API answers;
 * a success closes it with the Figma "Portafolio archivado" notice, a failure keeps it open.
 */
export function ArchivePortfolioDialog({
  portfolio,
  open,
  onOpenChange,
}: ArchivePortfolioDialogProps) {
  const { t } = useTranslation();
  const archive = useArchivePortfolio();

  const archivePortfolio = () => {
    if (!portfolio) {
      return;
    }
    archive.mutate(portfolio.id, {
      onSuccess: (archived) => {
        toast.success(t("portfolioArchive.archived.title"), {
          description: t("portfolioArchive.archived.description", { name: archived.name }),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t("portfolioArchive.failed.title"), {
          description: t("portfolioArchive.failed.description"),
        });
      },
    });
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!archive.isPending) {
          onOpenChange(next);
        }
      }}
      open={open && portfolio !== null}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("portfolioArchive.title")}</DialogTitle>
          <DialogDescription>
            {t("portfolioArchive.description", { name: portfolio?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="h-6 p-0" />
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={archive.isPending} variant="outline">
              {t("portfolioForm.cancel")}
            </Button>
          </DialogClose>
          <Button loading={archive.isPending} onClick={archivePortfolio} variant="destructive">
            {archive.isPending ? t("portfolioArchive.archiving") : t("portfolioArchive.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
