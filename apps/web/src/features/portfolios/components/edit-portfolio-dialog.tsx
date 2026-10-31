import { zodResolver } from "@hookform/resolvers/zod";
import type { PortfolioResponse } from "@trading/contracts";
import { useForm } from "react-hook-form";
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
import { useDiscardGuard, useReportDirty } from "../hooks/use-discard-guard";
import { useUpdatePortfolio } from "../hooks/use-update-portfolio";
import {
  portfolioFormSchema,
  portfolioToFormValues,
  toUpdatePortfolioBody,
  type PortfolioFormValues,
} from "../lib/portfolio-form";
import { DiscardPortfolioDialog } from "./discard-portfolio-dialog";
import { PortfolioFields } from "./portfolio-fields";

interface EditPortfolioDialogProps {
  /** The portfolio being edited; the dialog renders nothing without one. */
  portfolio: PortfolioResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The Figma "Editar portafolio" dialog: the create form filled with the portfolio, the base
 * currency greyed out. Saving locks it like the create dialog; a success closes it with a toast,
 * a failure keeps what the user typed. Saving with nothing changed just closes, and dismissing
 * with changes asks "¿Salir sin guardar?" first.
 */
export function EditPortfolioDialog({ portfolio, open, onOpenChange }: EditPortfolioDialogProps) {
  const update = useUpdatePortfolio();
  const guard = useDiscardGuard({ locked: update.isPending, onOpenChange });

  return (
    <>
      <Dialog onOpenChange={guard.handleOpenChange} open={open && portfolio !== null}>
        <DialogContent aria-describedby={undefined} mobileSheet>
          {portfolio ? (
            <EditPortfolioForm
              onDirtyChange={guard.setDirty}
              onSaved={guard.close}
              portfolio={portfolio}
              update={update}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <DiscardPortfolioDialog
        onDiscard={guard.close}
        onKeepEditing={guard.keepEditing}
        open={guard.confirmingDiscard}
        variant="edit"
      />
    </>
  );
}

interface EditPortfolioFormProps {
  portfolio: PortfolioResponse;
  update: ReturnType<typeof useUpdatePortfolio>;
  onSaved: () => void;
  /** Whether the user has changed anything from the portfolio, so leaving can ask first. */
  onDirtyChange: (dirty: boolean) => void;
}

/** Mounted only while the dialog is open, so every opening starts from the portfolio's values. */
function EditPortfolioForm({ portfolio, update, onSaved, onDirtyChange }: EditPortfolioFormProps) {
  const { t } = useTranslation();
  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: portfolioToFormValues(portfolio),
  });
  useReportDirty(form.formState.isDirty, onDirtyChange);

  const submit = form.handleSubmit((values) => {
    const body = toUpdatePortfolioBody(portfolioFormSchema.parse(values), portfolio);
    if (Object.keys(body).length === 0) {
      onSaved();
      return;
    }
    update.mutate(
      { portfolioId: portfolio.id, body },
      {
        onSuccess: (saved) => {
          toast.success(t("portfolioEdit.saved.title"), {
            description: t("portfolioEdit.saved.description", { name: saved.name }),
          });
          onSaved();
        },
        onError: () => {
          toast.error(t("portfolioEdit.saveFailed.title"), {
            description: t("portfolioEdit.saveFailed.description"),
          });
        },
      },
    );
  });

  return (
    <form
      className="flex min-h-0 flex-col"
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("portfolioEdit.title")}</DialogTitle>
        <DialogDescription>{t("portfolioEdit.subtitle")}</DialogDescription>
      </DialogHeader>
      <DialogBody className="gap-4">
        <PortfolioFields baseCurrencyLocked disabled={update.isPending} form={form} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={update.isPending} type="button" variant="outline">
            {t("portfolioForm.cancel")}
          </Button>
        </DialogClose>
        <Button loading={update.isPending} type="submit">
          {update.isPending ? t("portfolioEdit.submitting") : t("portfolioEdit.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
