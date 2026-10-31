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

interface NewPortfolioFieldsProps {
  form: UseFormReturn<PortfolioFormValues>;
  /** Locks every field, while the portfolio is being created. */
  disabled?: boolean;
}

/**
 * The three fields of the "Nuevo portafolio" dialog: name, description and base currency. The
 * form lives in the parent, which owns the submit; the errors shown here are the app's own
 * messages, chosen by which field failed, so they follow the language.
 */
export function NewPortfolioFields({ form, disabled = false }: NewPortfolioFieldsProps) {
  const { t } = useTranslation();
  const {
    control,
    register,
    formState: { errors },
  } = form;

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
        description={t("portfolioForm.baseCurrency.help")}
        disabled={disabled}
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
                {BASE_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {t(`portfolioForm.baseCurrency.options.${currency}`)}
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
