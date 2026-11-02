import { zodResolver } from "@hookform/resolvers/zod";
import type { AssetResponse, CreateTransactionResponse } from "@trading/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { rejectionReason } from "@/api/rejection-reason";
import { Alert } from "@/components/ui/alert";
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
import { useDiscardGuard, useReportDirty } from "@/features/portfolios/hooks/use-discard-guard";
import { usePositions } from "@/features/portfolios/hooks/use-positions";
import { useCreateTransaction } from "../hooks/use-create-transaction";
import {
  emptyTransactionForm,
  toCreateTransactionBody,
  transactionFormSchema,
  type TransactionFormValues,
} from "../lib/transaction-form";
import { DiscardTransactionDialog } from "./discard-transaction-dialog";
import { TransactionFields } from "./transaction-fields";

/**
 * The Figma panel is a drawer at the right from the tablet width up, 440 px wide and as tall as
 * the screen; below it the dialog is the bottom sheet it already is.
 */
const DRAWER =
  "tablet:top-0 tablet:right-0 tablet:left-auto tablet:h-dvh tablet:max-h-none tablet:w-110 tablet:max-w-full tablet:translate-x-0 tablet:translate-y-0 tablet:rounded-none tablet:data-open:zoom-in-100 tablet:data-open:slide-in-from-right tablet:data-closed:zoom-out-100 tablet:data-closed:slide-out-to-right";

interface NewTransactionPanelProps {
  portfolioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The API recorded the transaction; the panel closes itself right after. The asset comes along
   * because the response only carries its id, and the caller may want its symbol.
   */
  onRecorded: (response: CreateTransactionResponse, asset: AssetResponse) => void;
}

/**
 * The Figma "Nueva transacción" panel. Recording locks it: the fields and "Cancelar" are
 * disabled, the button reads "Registrando…", and neither the close button, Escape nor a click
 * outside can dismiss it until the API answers. A failure keeps what was typed and shows an alert
 * with "Reintentar", which sends the same transaction again. Dismissing it with something typed
 * first asks "¿Salir sin guardar?"; an untouched form closes straight away.
 */
export function NewTransactionPanel({
  portfolioId,
  open,
  onOpenChange,
  onRecorded,
}: NewTransactionPanelProps) {
  const create = useCreateTransaction(portfolioId);
  const guard = useDiscardGuard({ locked: create.isPending, onOpenChange });

  return (
    <>
      <Dialog onOpenChange={guard.handleOpenChange} open={open}>
        <DialogContent aria-describedby={undefined} className={DRAWER} mobileSheet>
          <NewTransactionForm
            create={create}
            onDirtyChange={guard.setDirty}
            onRecorded={(response, asset) => {
              onRecorded(response, asset);
              guard.close();
            }}
            portfolioId={portfolioId}
          />
        </DialogContent>
      </Dialog>
      <DiscardTransactionDialog
        onDiscard={guard.close}
        onKeepEditing={guard.keepEditing}
        open={guard.confirmingDiscard}
      />
    </>
  );
}

interface NewTransactionFormProps {
  portfolioId: string;
  create: ReturnType<typeof useCreateTransaction>;
  onRecorded: (response: CreateTransactionResponse, asset: AssetResponse) => void;
  /** Whether the user has changed anything from the empty form, so leaving can ask first. */
  onDirtyChange: (dirty: boolean) => void;
}

/** Mounted only while the panel is open, so every opening starts from an empty form. */
function NewTransactionForm({
  portfolioId,
  create,
  onRecorded,
  onDirtyChange,
}: NewTransactionFormProps) {
  const { t } = useTranslation();
  // Taken once: a retry must send the same moment, or its body differs and the Idempotency-Key with it.
  const [openedAt] = useState(() => new Date());
  const [asset, setAsset] = useState<AssetResponse | null>(null);
  const positions = usePositions(portfolioId);
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: emptyTransactionForm(openedAt),
  });
  useReportDirty(form.formState.isDirty, onDirtyChange);
  // The API understood the request and refused it (selling more than is held, say): its message is
  // the reason, and sending the same transaction again cannot change the answer. Anything else
  // (a dropped connection, a timeout, a server error) says nothing about the transaction, so it
  // keeps the generic text and "Reintentar".
  const rejection = rejectionReason(create.error);

  // An asset the portfolio does not hold yet starts from zero; until the positions arrive it is unknown.
  const held = asset
    ? (positions.data?.find((position) => position.assetId === asset.id)?.quantity ??
      (positions.data ? 0 : undefined))
    : undefined;

  const submit = form.handleSubmit((values) => {
    if (!asset) return;
    // The resolver has parsed the values, so they are the schema's output.
    const body = toCreateTransactionBody(
      transactionFormSchema.parse(values),
      asset.currency,
      openedAt,
    );
    create.mutate(body, {
      onSuccess: (response) => {
        onRecorded(response, asset);
      },
    });
  });

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("transactionForm.title")}</DialogTitle>
        <DialogDescription>{t("transactionForm.subtitle")}</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex-1 gap-4">
        {create.isError ? (
          <Alert
            action={
              rejection === null ? (
                <Button
                  onClick={() => {
                    void submit();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("transactionForm.failed.retry")}
                </Button>
              ) : null
            }
            description={rejection ?? t("transactionForm.failed.description")}
            title={t("transactionForm.failed.title")}
            tone="error"
          />
        ) : null}
        <TransactionFields
          asset={asset}
          disabled={create.isPending}
          form={form}
          held={held}
          onAssetChange={setAsset}
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={create.isPending} type="button" variant="outline">
            {t("transactionForm.cancel")}
          </Button>
        </DialogClose>
        <Button loading={create.isPending} type="submit">
          {create.isPending ? t("transactionForm.submitting") : t("transactionForm.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
