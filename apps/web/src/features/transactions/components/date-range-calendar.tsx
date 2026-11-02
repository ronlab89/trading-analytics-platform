import { useState } from "react";
import { DayPicker, type DateRange as PickerRange } from "react-day-picker";
import { enUS, es } from "react-day-picker/locale";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatCalendarDay } from "@/lib/format-date";
import {
  fromCalendarDay,
  matchingPreset,
  presetRange,
  RANGE_PRESETS,
  toCalendarDay,
  type RangePreset,
} from "../lib/date-range";
import type { DateRange } from "../lib/transaction-filters";

interface DateRangeCalendarProps {
  /** The range chosen so far, or null for none. */
  value: DateRange | null;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
  /** Months side by side: two from the desktop width, one where there is no room for more. */
  months?: 1 | 2 | undefined;
  /** The day "today" means for the presets and the calendar; a test fixes it. */
  today?: Date | undefined;
}

const DAY =
  "p-0 text-center text-sm [&>button]:size-9 [&>button]:rounded-md [&>button]:hover:bg-(--color-surface-secondary) [&>button]:focus-visible:outline-2 [&>button]:focus-visible:outline-(--color-button-focus-ring)";
const END =
  "[&>button]:bg-(--color-button-primary-background) [&>button]:text-(--color-button-primary-foreground) [&>button]:hover:bg-(--color-button-primary-background-hover)";

const PICKER_CLASSES = {
  root: "relative",
  months: "relative flex flex-wrap gap-8",
  month: "flex flex-col",
  month_caption: "flex h-9 items-center justify-center text-sm font-medium capitalize",
  nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
  button_previous:
    "inline-flex size-9 items-center justify-center rounded-md hover:bg-(--color-surface-secondary)",
  button_next:
    "inline-flex size-9 items-center justify-center rounded-md hover:bg-(--color-surface-secondary)",
  chevron: "size-4 fill-(--color-text-default)",
  month_grid: "mt-2 border-collapse",
  weekday: "size-9 text-xs font-normal text-(--color-text-secondary)",
  day: DAY,
  today: "font-semibold",
  outside: "text-(--color-text-secondary) opacity-40",
  range_start: END,
  range_end: END,
  range_middle: "bg-(--color-surface-secondary)",
};

/**
 * The Figma date range picker: presets on the left, the calendar next to them and, below, the
 * range written out with "Cancelar" and "Aplicar". Nothing leaves it until "Aplicar", which needs
 * both ends: a first click only starts a range. "Personalizado" is any range that is not a preset,
 * and choosing it clears the selection so the days can be picked from scratch.
 */
export function DateRangeCalendar({
  value,
  onApply,
  onCancel,
  months = 2,
  today = new Date(),
}: DateRangeCalendarProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<PickerRange | undefined>(
    value ? { from: fromCalendarDay(value.from), to: fromCalendarDay(value.to) } : undefined,
  );
  const [month, setMonth] = useState(draft?.from ?? today);

  const first = draft?.from;
  const last = draft?.to;
  const range: DateRange | null =
    first && last ? { from: toCalendarDay(first), to: toCalendarDay(last) } : null;
  const preset = matchingPreset(range, today);

  const choosePreset = (name: RangePreset) => {
    const chosen = presetRange(name, today);
    setDraft({ from: fromCalendarDay(chosen.from), to: fromCalendarDay(chosen.to) });
    setMonth(fromCalendarDay(chosen.from));
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-6 p-4">
        <div className="flex w-40 flex-col gap-1">
          {RANGE_PRESETS.map((name) => (
            <PresetButton
              key={name}
              label={t(`dateRange.presets.${name}`)}
              onClick={() => {
                choosePreset(name);
              }}
              selected={preset === name}
            />
          ))}
          <PresetButton
            label={t("dateRange.presets.custom")}
            onClick={() => {
              setDraft(undefined);
            }}
            selected={preset === null}
          />
        </div>
        <DayPicker
          classNames={PICKER_CLASSES}
          locale={i18n.language.startsWith("es") ? es : enUS}
          mode="range"
          month={month}
          numberOfMonths={months}
          onMonthChange={setMonth}
          onSelect={setDraft}
          // A first click only starts the range, and a click on a complete one starts another.
          resetOnSelect
          selected={draft}
          today={today}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-default) px-4 py-3">
        <p className="text-sm text-(--color-text-secondary)">
          {range
            ? `${formatCalendarDay(range.from, i18n.language)} – ${formatCalendarDay(range.to, i18n.language)}`
            : null}
        </p>
        <div className="flex gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            {t("dateRange.cancel")}
          </Button>
          <Button
            disabled={range === null}
            onClick={() => {
              if (range) onApply(range);
            }}
            type="button"
          >
            {t("dateRange.apply")}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PresetButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function PresetButton({ label, selected, onClick }: PresetButtonProps) {
  return (
    <button
      aria-pressed={selected}
      className="rounded-md px-3 py-2 text-left text-sm hover:bg-(--color-surface-secondary) aria-pressed:bg-(--color-surface-secondary) aria-pressed:font-medium focus-visible:outline-2 focus-visible:outline-(--color-button-focus-ring)"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
