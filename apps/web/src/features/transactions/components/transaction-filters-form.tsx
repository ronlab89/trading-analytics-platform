import { Calendar } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CheckboxItem } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { useFieldControlProps } from "@/components/ui/field-context";
import { inputVariants } from "@/components/ui/input";
import { formatCalendarDay } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  NO_FILTERS,
  sameFilters,
  type DateRange,
  type TransactionFilters,
  type TransactionTypeFilter,
} from "../lib/transaction-filters";
import { AssetCombobox } from "./asset-combobox";
import { DateRangeCalendar } from "./date-range-calendar";

const TYPES: readonly TransactionTypeFilter[] = ["BUY", "SELL"];

interface TransactionFiltersFormProps {
  /** The filters in force; the form starts from them and "Aplicar filtros" waits for a change. */
  value: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
  onCancel: () => void;
  /**
   * The Figma has two arrangements: the panel (a title with "Limpiar todo", and "Cancelar" next to
   * "Aplicar filtros") and the mobile sheet ("Limpiar" next to "Aplicar filtros").
   */
  layout?: "panel" | "sheet";
  /** Months the date calendar shows side by side; the container knows how much room there is. */
  months?: 1 | 2 | undefined;
  /** The day "today" means for the date presets; a test fixes it. */
  today?: Date | undefined;
}

/**
 * The content of the Figma "Filtros": the type (Compra, Venta), the asset and the date range. What
 * is chosen is a draft: nothing narrows the list until "Aplicar filtros", which stays off until the
 * draft asks for something different from what is already in force.
 */
export function TransactionFiltersForm({
  value,
  onApply,
  onCancel,
  layout = "panel",
  months,
  today,
}: TransactionFiltersFormProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const isSheet = layout === "sheet";
  const changed = !sameFilters(draft, value);
  const clearable = !sameFilters(draft, NO_FILTERS);

  const toggleType = (type: TransactionTypeFilter, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      types: checked ? [...current.types, type] : current.types.filter((chosen) => chosen !== type),
    }));
  };

  const clear = () => {
    setDraft(NO_FILTERS);
  };

  return (
    <form
      className="flex flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-sm font-medium text-(--color-text-default)">
          {t("transactionFilters.title")}
        </h2>
        {isSheet ? null : (
          <Button
            className="text-(--color-text-secondary) enabled:text-(--color-text-default)"
            disabled={!clearable}
            onClick={clear}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("transactionFilters.clearAll")}
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-(--color-text-default)">
            {t("transactionFilters.type")}
          </legend>
          <div className={cn("grid gap-2", isSheet ? "grid-cols-1" : "grid-cols-2")}>
            {TYPES.map((type) => (
              <CheckboxItem
                checked={draft.types.includes(type)}
                key={type}
                label={t(`transactions.type.${type}`)}
                onCheckedChange={(checked) => {
                  toggleType(type, checked === true);
                }}
              />
            ))}
          </div>
        </fieldset>
        <Field label={t("transactionFilters.asset")}>
          <AssetCombobox
            onChange={(asset) => {
              setDraft((current) => ({ ...current, asset }));
            }}
            placeholder={t("transactionFilters.allAssets")}
            value={draft.asset}
          />
        </Field>
        <Field label={t("transactionFilters.date")}>
          <DateRangeField
            months={months}
            onChange={(range) => {
              setDraft((current) => ({ ...current, range }));
            }}
            placeholder={t(
              isSheet ? "transactionFilters.selectRange" : "transactionFilters.anyDate",
            )}
            side={isSheet ? "bottom" : "right"}
            today={today}
            value={draft.range}
          />
        </Field>
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 border-t border-(--color-border-default) px-4 py-3",
          isSheet && "*:flex-1",
        )}
      >
        {isSheet ? (
          <Button disabled={!clearable} onClick={clear} type="button" variant="ghost">
            {t("transactionFilters.clear")}
          </Button>
        ) : (
          <Button onClick={onCancel} type="button" variant="outline">
            {t("transactionFilters.cancel")}
          </Button>
        )}
        <Button disabled={!changed} type="submit">
          {t("transactionFilters.apply")}
        </Button>
      </div>
    </form>
  );
}

interface DateRangeFieldProps {
  value: DateRange | null;
  onChange: (range: DateRange) => void;
  placeholder: string;
  side: "right" | "bottom";
  months?: 1 | 2 | undefined;
  today?: Date | undefined;
}

/** The "Fecha" box: it says the range in force and opens the calendar next to it. */
function DateRangeField({
  value,
  onChange,
  placeholder,
  side,
  months,
  today,
}: DateRangeFieldProps) {
  const { i18n } = useTranslation();
  const { required, ...field } = useFieldControlProps({});
  const [open, setOpen] = useState(false);

  return (
    <PopoverPrimitive.Root onOpenChange={setOpen} open={open}>
      <PopoverPrimitive.Trigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            inputVariants(),
            "flex items-center gap-2 text-left",
            value === null && "text-(--color-text-secondary)",
          )}
          type="button"
          {...field}
          {...(required ? { "aria-required": true } : {})}
        >
          <Calendar aria-hidden="true" className="size-4 shrink-0 text-(--color-text-secondary)" />
          <span className="truncate">
            {value
              ? `${formatCalendarDay(value.from, i18n.language)} – ${formatCalendarDay(value.to, i18n.language)}`
              : placeholder}
          </span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 max-w-[calc(100vw-1rem)] rounded-xl border border-(--color-border-default) bg-(--color-surface-card) shadow-dialog outline-hidden"
          collisionPadding={8}
          side={side}
          sideOffset={8}
        >
          <DateRangeCalendar
            months={months}
            onApply={(range) => {
              onChange(range);
              setOpen(false);
            }}
            onCancel={() => {
              setOpen(false);
            }}
            today={today}
            value={value}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
