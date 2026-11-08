import type { AssetResponse } from "@trading/contracts";
import type { ReactNode } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencySymbol, formatMoney } from "@/lib/format-number";
import { transactionImpact } from "../lib/transaction-impact";
import type { TransactionFormValues } from "../lib/transaction-form";
import { AssetCombobox } from "./asset-combobox";
import { DateField } from "./date-field";
import { TransactionImpactSummary } from "./transaction-impact-summary";

interface TransactionFieldsProps {
  form: UseFormReturn<TransactionFormValues>;
  /** The asset chosen. The form keeps only its id; the currency and the symbol come from here. */
  asset: AssetResponse | null;
  onAssetChange: (asset: AssetResponse) => void;
  /** Units of the chosen asset the portfolio holds now, or undefined while that is not known. */
  held: number | undefined;
  /** Locks every field, while the transaction is being recorded. */
  disabled?: boolean;
}

/** A text box with a mark inside, before the text (`$`) or after it (`uds`), as the Figma draws it. */
function AdornedInput({
  prefix,
  suffix,
  children,
}: {
  prefix?: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {prefix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-(--color-text-secondary)"
        >
          {prefix}
        </span>
      ) : null}
      {suffix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-(--color-text-secondary)"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The fields of the Figma "Nueva transacción" panel, and under them the "Resumen del impacto" once
 * the quantity and the price make one. The form lives in the parent, which owns the submit; the
 * errors shown here are the app's own messages, chosen by which field failed, so they follow the
 * language.
 */
export function TransactionFields({
  form,
  asset,
  onAssetChange,
  held,
  disabled = false,
}: TransactionFieldsProps) {
  const { t } = useTranslation();
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = form;
  const values = useWatch({ control });
  const currency = asset?.currency ?? "USD";
  const symbol = currencySymbol(currency);
  const impact = asset
    ? transactionImpact({
        type: values.type ?? "",
        quantity: (values.quantity ?? "").trim(),
        price: (values.price ?? "").trim(),
        fees: (values.fees ?? "").trim(),
        currency,
        held,
      })
    : null;

  return (
    <>
      <Field
        disabled={disabled}
        error={errors.type ? t("transactionForm.type.required") : undefined}
        label={t("transactionForm.type.label")}
        required
      >
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select name={field.name} onValueChange={field.onChange} value={field.value}>
              <SelectTrigger onBlur={field.onBlur} ref={field.ref}>
                <SelectValue placeholder={t("transactionForm.type.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">{t("transactionForm.type.options.BUY")}</SelectItem>
                <SelectItem value="SELL">{t("transactionForm.type.options.SELL")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        disabled={disabled}
        error={errors.assetId ? t("transactionForm.asset.required") : undefined}
        label={t("transactionForm.asset.label")}
        required
      >
        <AssetCombobox
          onChange={(next) => {
            onAssetChange(next);
            setValue("assetId", next.id, { shouldDirty: true, shouldValidate: true });
          }}
          value={asset}
        />
      </Field>
      <Field
        disabled={disabled}
        error={errors.executedAt ? t("transactionForm.date.invalid") : undefined}
        label={t("transactionForm.date.label")}
        required
      >
        <Controller
          control={control}
          name="executedAt"
          render={({ field }) => (
            <DateField onBlur={field.onBlur} onChange={field.onChange} value={field.value} />
          )}
        />
      </Field>
      <Field
        disabled={disabled}
        error={errors.quantity ? t("transactionForm.quantity.invalid") : undefined}
        label={t("transactionForm.quantity.label")}
        required
      >
        <AdornedInput suffix={t("transactionForm.quantity.unit")}>
          <Input
            autoComplete="off"
            className="pr-12"
            inputMode="decimal"
            placeholder="0"
            {...register("quantity")}
          />
        </AdornedInput>
      </Field>
      <Field
        disabled={disabled}
        error={errors.price ? t("transactionForm.price.invalid") : undefined}
        label={t("transactionForm.price.label")}
        required
      >
        <AdornedInput prefix={symbol}>
          <Input
            autoComplete="off"
            className="pl-7"
            inputMode="decimal"
            placeholder="0.00"
            {...register("price")}
          />
        </AdornedInput>
      </Field>
      <Field
        description={t("transactionForm.fees.help", {
          amount: formatMoney({ amount: "0", currency }),
        })}
        disabled={disabled}
        error={errors.fees ? t("transactionForm.fees.invalid") : undefined}
        label={
          <>
            {t("transactionForm.fees.label")}
            <span className="text-xs font-normal text-(--color-text-secondary)">
              {t("transactionForm.optional")}
            </span>
          </>
        }
      >
        <AdornedInput prefix={symbol}>
          <Input
            autoComplete="off"
            className="pl-7"
            inputMode="decimal"
            placeholder="0.00"
            {...register("fees")}
          />
        </AdornedInput>
      </Field>
      {asset && impact ? <TransactionImpactSummary impact={impact} symbol={asset.symbol} /> : null}
    </>
  );
}
