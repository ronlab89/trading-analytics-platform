import { Controller, type UseFormReturn } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import type { PortfolioFormValues } from "../lib/portfolio-form";

/** The base currencies the Figma "Nuevo portafolio" dialog offers. */
const BASE_CURRENCIES = ["USD", "EUR", "GBP", "COP"] as const;

interface PortfolioFieldsProps {
  form: UseFormReturn<PortfolioFormValues>;
  /** Locks every field, while the portfolio is being created. */
  disabled?: boolean;
  /** Greys out the base currency and says it cannot change, as when editing a portfolio. */
  baseCurrencyLocked?: boolean;
}

/**
 * The three fields of the "Nuevo portafolio" dialog: name, description and base currency. The
 * form lives in the parent, which owns the submit; the errors shown here are the app's own
 * messages, chosen by which field failed, so they follow the language.
 */
export function PortfolioFields({
  form,
  disabled = false,
  baseCurrencyLocked = false,
}: PortfolioFieldsProps) {
  const { t } = useTranslation();
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const currentCurrency = form.getValues("baseCurrency");
  // A locked currency outside the four offered still has to show, so it joins the list by its code.
  const currencies: readonly string[] =
    baseCurrencyLocked && currentCurrency && !BASE_CURRENCIES.some((c) => c === currentCurrency)
      ? [...BASE_CURRENCIES, currentCurrency]
      : BASE_CURRENCIES;

  return (
    <>
      <Field
        disabled={disabled}
        error={errors.name ? t("portfolioForm.name.required") : undefined}
        label={t("portfolioForm.name.label")}
        required
      >
        <Input placeholder={t("portfolioForm.name.placeholder")} {...register("name")} />
      </Field>
      <Field disabled={disabled} label={t("portfolioForm.description.label")}>
        <Textarea
          className="min-h-9"
          placeholder={t("portfolioForm.description.placeholder")}
          rows={1}
          {...register("description")}
        />
      </Field>
      <Field
        description={t(
          baseCurrencyLocked
            ? "portfolioForm.baseCurrency.locked"
            : "portfolioForm.baseCurrency.help",
        )}
        disabled={disabled || baseCurrencyLocked}
        error={errors.baseCurrency ? t("portfolioForm.baseCurrency.required") : undefined}
        label={t("portfolioForm.baseCurrency.label")}
        required
      >
        <Controller
          control={control}
          name="baseCurrency"
          render={({ field }) => (
            <Select name={field.name} onValueChange={field.onChange} value={field.value}>
              <SelectTrigger onBlur={field.onBlur} ref={field.ref}>
                <SelectValue placeholder={t("portfolioForm.baseCurrency.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {t(`portfolioForm.baseCurrency.options.${currency}`, {
                      defaultValue: currency,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    </>
  );
}
