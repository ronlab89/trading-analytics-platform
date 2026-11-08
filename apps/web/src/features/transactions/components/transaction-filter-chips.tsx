import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatCalendarRange } from "@/lib/format-date";
import { activeFilterCount, NO_FILTERS, type TransactionFilters } from "../lib/transaction-filters";

interface TransactionFilterChipsProps {
  /** The filters in force. */
  value: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}

/**
 * The Figma row under the search: one chip for each filter that narrows the list, each with its
 * "x" to remove just that one, and "Limpiar todo". With nothing to show it takes no room at all.
 */
export function TransactionFilterChips({ value, onChange }: TransactionFilterChipsProps) {
  const { t, i18n } = useTranslation();
  if (activeFilterCount(value) === 0) return null;

  const [type] = value.types;
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (value.types.length === 1 && type !== undefined) {
    chips.push({
      key: "type",
      label: t("transactionFilters.chips.type", { value: t(`transactions.type.${type}`) }),
      clear: () => {
        onChange({ ...value, types: [] });
      },
    });
  }
  if (value.asset) {
    chips.push({
      key: "asset",
      label: t("transactionFilters.chips.asset", { value: value.asset.symbol }),
      clear: () => {
        onChange({ ...value, asset: null });
      },
    });
  }
  if (value.range) {
    chips.push({
      key: "range",
      label: t("transactionFilters.chips.date", {
        value: formatCalendarRange(value.range.from, value.range.to, i18n.language),
      }),
      clear: () => {
        onChange({ ...value, range: null });
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label={t("transactionFilters.chips.list")} className="contents">
        {chips.map(({ key, label, clear }) => (
          <li
            className="inline-flex h-8 items-center gap-2 rounded-md bg-(--color-surface-secondary) pr-1 pl-3 text-sm text-(--color-text-default)"
            key={key}
          >
            {label}
            <Button
              aria-label={t("transactionFilters.chips.remove", { filter: label })}
              onClick={clear}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        onClick={() => {
          onChange(NO_FILTERS);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t("transactionFilters.clearAll")}
      </Button>
    </div>
  );
}
