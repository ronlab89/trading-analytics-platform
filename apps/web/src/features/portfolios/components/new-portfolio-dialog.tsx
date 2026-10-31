import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
import { useCreatePortfolio } from "../hooks/use-create-portfolio";
import {
  emptyPortfolioForm,
  portfolioFormSchema,
  toCreatePortfolioBody,
  type PortfolioFormValues,
} from "../lib/portfolio-form";
import { DiscardPortfolioDialog } from "./discard-portfolio-dialog";
import { NewPortfolioFields } from "./new-portfolio-fields";

interface NewPortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The Figma "Nuevo portafolio" dialog. Creating the portfolio locks the dialog: the fields and
 * "Cancelar" are disabled, "Crear portafolio" becomes "Creando…", and neither the close button,
 * Escape nor a click outside can dismiss it until the API answers. A success closes it with a
 * toast; a failure keeps what the user typed and announces it with a toast. Dismissing it with
 * something typed first asks "¿Salir sin guardar?"; an untouched form closes straight away.
 */
export function NewPortfolioDialog({ open, onOpenChange }: NewPortfolioDialogProps) {
  const create = useCreatePortfolio();
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const close = () => {
    setConfirmingDiscard(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (create.isPending) {
            return;
          }
          if (next) {
            onOpenChange(true);
          } else if (dirty) {
            setConfirmingDiscard(true);
          } else {
            close();
          }
        }}
        open={open}
      >
        <DialogContent aria-describedby={undefined}>
          <NewPortfolioForm create={create} onCreated={close} onDirtyChange={setDirty} />
        </DialogContent>
      </Dialog>
      <DiscardPortfolioDialog
        onDiscard={close}
        onKeepEditing={() => {
          setConfirmingDiscard(false);
        }}
        open={confirmingDiscard}
      />
    </>
  );
}

interface NewPortfolioFormProps {
  create: ReturnType<typeof useCreatePortfolio>;
  onCreated: () => void;
  /** Whether the user has changed anything from the empty form, so leaving can ask first. */
  onDirtyChange: (dirty: boolean) => void;
}

/** Mounted only while the dialog is open, so every opening starts from an empty form. */
function NewPortfolioForm({ create, onCreated, onDirtyChange }: NewPortfolioFormProps) {
  const { t } = useTranslation();
  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: emptyPortfolioForm,
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => {
    return () => {
      onDirtyChange(false);
    };
  }, [onDirtyChange]);

  const submit = form.handleSubmit((values) => {
    // The resolver has parsed the values, so they are the schema's output.
    const body = toCreatePortfolioBody(portfolioFormSchema.parse(values));
    create.mutate(body, {
      onSuccess: (portfolio) => {
        toast.success(t("portfolioForm.created.title"), {
          description: t("portfolioForm.created.description", { name: portfolio.name }),
        });
        onCreated();
      },
      onError: () => {
        toast.error(t("portfolioForm.createFailed.title"), {
          description: t("portfolioForm.createFailed.description"),
        });
      },
    });
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
        <DialogTitle>{t("portfolioForm.title")}</DialogTitle>
        <DialogDescription>{t("portfolioForm.subtitle")}</DialogDescription>
      </DialogHeader>
      <DialogBody className="gap-4">
        <NewPortfolioFields disabled={create.isPending} form={form} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={create.isPending} type="button" variant="outline">
            {t("portfolioForm.cancel")}
          </Button>
        </DialogClose>
        <Button loading={create.isPending} type="submit">
          {create.isPending ? t("portfolioForm.submitting") : t("portfolioForm.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
