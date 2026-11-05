import { zodResolver } from "@hookform/resolvers/zod";
import type { AssetResponse } from "@trading/contracts";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { rejectionReason } from "@/api/rejection-reason";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxItem } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssetCombobox } from "@/features/transactions/components/asset-combobox";
import { useMarketPrices } from "@/features/watchlist/hooks/use-market-prices";
import { currencySymbol, formatMoney } from "@/lib/format-number";
import { useCreateAlert } from "../hooks/use-create-alert";
import { useUpdateAlert } from "../hooks/use-update-alert";
import {
  alertFormFromRow,
  alertFormSchema,
  emptyAlertForm,
  toCreateAlertBody,
  toUpdateAlertBody,
  type AlertFormValues,
} from "../lib/alert-form";
import type { AlertRow } from "../lib/alert-row";
import { plainDecimal } from "../lib/plain-decimal";
import { priceHint } from "../lib/price-hint";

/** What the form needs to know of the asset: how to name it and the currency of its prices. */
export type AlertAsset = Pick<AssetResponse, "id" | "symbol" | "name" | "currency">;

const NO_ASSET_IDS: readonly string[] = [];

interface AlertFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The alert being edited. Without it the dialog creates one. */
  alert?: AlertRow | undefined;
  /** The asset of a new alert, when the caller already knows it; it is then locked. */
  asset?: AlertAsset | undefined;
}

function assetOfRow(row: AlertRow): AlertAsset | null {
  if (row.symbol === null || row.name === null || row.currency === null) return null;
  return { id: row.assetId, symbol: row.symbol, name: row.name, currency: row.currency };
}

/**
 * The Figma create / edit alert dialog, a bottom sheet on a phone. A new alert picks its asset (or
 * has it from the caller, locked); an edited one keeps the asset it has, since the API does not
 * change what an alert watches. Saving locks it: the fields and "Cancel" are disabled and neither
 * Escape nor a click outside dismisses it until the API answers. A refusal shows its reason; any
 * other failure keeps what was typed and offers to try again.
 */
export function AlertFormDialog({ open, onOpenChange, alert, asset }: AlertFormDialogProps) {
  const { t } = useTranslation();
  const create = useCreateAlert();
  const update = useUpdateAlert();
  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) {
          create.reset();
          update.reset();
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent aria-describedby={undefined} mobileSheet>
        <AlertForm
          alert={alert}
          asset={asset}
          create={create}
          onSaved={(kind) => {
            toast.success(t(`alerts.form.saved.${kind}`));
            create.reset();
            update.reset();
            onOpenChange(false);
          }}
          update={update}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AlertFormProps {
  alert: AlertRow | undefined;
  asset: AlertAsset | undefined;
  create: ReturnType<typeof useCreateAlert>;
  update: ReturnType<typeof useUpdateAlert>;
  onSaved: (kind: "created" | "updated") => void;
}

/** A text box with the currency mark inside, before the text, as the transaction form draws it. */
function PriceInput({ symbol, children }: { symbol: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-(--color-text-secondary)"
      >
        {symbol}
      </span>
    </div>
  );
}

/** Mounted only while the dialog is open, so every opening starts from the alert or an empty form. */
function AlertForm({ alert, asset: given, create, update, onSaved }: AlertFormProps) {
  const { t } = useTranslation();
  const locked = alert !== undefined || given !== undefined;
  const lockedAsset = alert ? assetOfRow(alert) : (given ?? null);
  const [picked, setPicked] = useState<AssetResponse | null>(null);
  const asset: AlertAsset | null = locked ? lockedAsset : picked;
  const form = useForm<AlertFormValues>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: alert ? alertFormFromRow(alert) : emptyAlertForm(given?.id),
  });
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = form;
  const values = useWatch({ control });

  const mutation = alert ? update : create;
  const rejection = rejectionReason(mutation.error);
  const currency = asset?.currency ?? null;

  const assetIds = asset ? [asset.id] : NO_ASSET_IDS;
  const price = useMarketPrices(assetIds).data?.get(asset?.id ?? "")?.price;
  const threshold = (values.threshold ?? "").trim();
  const thresholdNumber = /^\d+(\.\d+)?$/.test(threshold) ? Number(threshold) : 0;
  const hint =
    price && currency !== null && thresholdNumber > 0
      ? priceHint(values.condition ?? "ABOVE", thresholdNumber, Number(price.amount))
      : null;

  const submit = form.handleSubmit((raw) => {
    const parsed = alertFormSchema.parse(raw);
    if (alert) {
      const body = toUpdateAlertBody(parsed, alert);
      if (body === null) {
        onSaved("updated");
        return;
      }
      update.mutate(
        { alertId: alert.id, body },
        {
          onSuccess: () => {
            onSaved("updated");
          },
        },
      );
      return;
    }
    create.mutate(toCreateAlertBody(parsed), {
      onSuccess: () => {
        onSaved("created");
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
        <DialogTitle>{t(alert ? "alerts.form.titleEdit" : "alerts.form.titleCreate")}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex-1 gap-4">
        {mutation.isError ? (
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
                  {t("alerts.form.failed.retry")}
                </Button>
              ) : null
            }
            description={rejection ?? t("alerts.form.failed.description")}
            title={t("alerts.form.failed.title")}
            tone="error"
          />
        ) : null}
        <Field
          disabled={mutation.isPending}
          error={errors.assetId ? t("alerts.form.asset.required") : undefined}
          label={t("alerts.form.asset.label")}
          required
        >
          {locked ? (
            <Input
              disabled
              readOnly
              value={asset ? `${asset.symbol} · ${asset.name}` : t("markets.unknownAsset")}
            />
          ) : (
            <AssetCombobox
              onChange={(next) => {
                setPicked(next);
                setValue("assetId", next.id, { shouldDirty: true, shouldValidate: true });
              }}
              value={picked}
            />
          )}
        </Field>
        <Field disabled={mutation.isPending} label={t("alerts.form.condition.label")} required>
          <Controller
            control={control}
            name="condition"
            render={({ field }) => (
              <Select name={field.name} onValueChange={field.onChange} value={field.value}>
                <SelectTrigger onBlur={field.onBlur} ref={field.ref}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABOVE">{t("alerts.condition.ABOVE")}</SelectItem>
                  <SelectItem value="BELOW">{t("alerts.condition.BELOW")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          disabled={mutation.isPending}
          error={errors.threshold ? t("alerts.form.threshold.invalid") : undefined}
          label={t("alerts.form.threshold.label")}
          required
        >
          <PriceInput symbol={currencySymbol(currency ?? "USD")}>
            <Input
              autoComplete="off"
              className="pl-7"
              inputMode="decimal"
              placeholder="0.00"
              {...register("threshold")}
            />
          </PriceInput>
        </Field>
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <CheckboxItem
              checked={field.value}
              description={t("alerts.form.enabled.help")}
              disabled={mutation.isPending}
              label={t("alerts.form.enabled.label")}
              onCheckedChange={(checked) => {
                field.onChange(checked === true);
              }}
            />
          )}
        />
        {hint && price && currency !== null ? (
          <p
            aria-live="polite"
            className="text-sm leading-5 text-(--color-text-secondary)"
            role="status"
          >
            {t(`alerts.form.hint.${hint.kind}${hint.direction}`, {
              price: formatMoney(price),
              threshold: formatMoney({ amount: plainDecimal(thresholdNumber), currency }),
            })}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={mutation.isPending} type="button" variant="outline">
            {t("alerts.form.cancel")}
          </Button>
        </DialogClose>
        <Button loading={mutation.isPending} type="submit">
          {t(
            mutation.isPending
              ? alert
                ? "alerts.form.saving"
                : "alerts.form.creating"
              : alert
                ? "alerts.form.save"
                : "alerts.create",
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
