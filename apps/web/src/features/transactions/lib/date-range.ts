import type { DateRange } from "./transaction-filters";

/** The ready-made ranges of the Figma date picker; "Personalizado" is any other range. */
export type RangePreset = "last7" | "last30" | "last90" | "thisYear";

export const RANGE_PRESETS: readonly RangePreset[] = ["last7", "last30", "last90", "thisYear"];

const pad = (value: number) => String(value).padStart(2, "0");

/** A date as the user's calendar writes its day, `YYYY-MM-DD`, with no time and no time zone. */
export function toCalendarDay(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The start of a calendar day (`YYYY-MM-DD`) on the user's clock. */
export function fromCalendarDay(day: string): Date {
  const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 0, 0, 0, 0);
}

const LAST_DAYS: Record<Exclude<RangePreset, "thisYear">, number> = {
  last7: 7,
  last30: 30,
  last90: 90,
};

/**
 * The range of a preset, ending today. "Últimos 7 días" is today and the six days before it, so it
 * holds seven days, and "Este año" runs from the first of January.
 */
export function presetRange(preset: RangePreset, today: Date): DateRange {
  const to = toCalendarDay(today);
  if (preset === "thisYear") {
    return { from: `${String(today.getFullYear())}-01-01`, to };
  }
  const first = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (LAST_DAYS[preset] - 1),
  );
  return { from: toCalendarDay(first), to };
}

/** The preset a range was built from, or null for a custom one. */
export function matchingPreset(range: DateRange | null, today: Date): RangePreset | null {
  if (range === null) return null;
  return (
    RANGE_PRESETS.find((preset) => {
      const candidate = presetRange(preset, today);
      return candidate.from === range.from && candidate.to === range.to;
    }) ?? null
  );
}
