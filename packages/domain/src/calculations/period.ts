/**
 * Preset periods.
 * Source: docs/16-analytics-spec.md §8 (ADR-004 points 5 and 6).
 *
 * Maps a preset period and its end date to the first day of the window. Pure
 * and deterministic (NFR-042): it never reads the clock. Day boundaries are UTC
 * calendar dates (ADR-004).
 */

import { addUtcDays, startOfUtcDay } from "./utc-date.js";

/** The presets served by the daily series. `1D` comes from `MarketPrice`. */
export const PRESET_PERIODS = ["1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"] as const;

export type PresetPeriod = (typeof PRESET_PERIODS)[number];

/**
 * The window of a preset: `from` is its first day and `anchor` is the baseline
 * day `from - 1`, whose value `V(anchor)` P/L subtracts (§7).
 */
export interface PeriodWindow {
  anchor: Date;
  from: Date;
}

/** The months that each month-based preset counts back from `to`. */
const MONTH_OFFSETS = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 } as const;

/**
 * `date` minus whole calendar months. A day that does not exist in the target
 * month is clamped to that month's last day (31 March - 1 month = 28 February).
 */
function subtractUtcMonths(date: Date, months: number): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() - months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDayOfMonth)));
}

/**
 * Returns the window of `period` ending on the UTC date of `to`, or `null` for
 * `ALL` when there is no transaction to start from.
 *
 * `1W` is 7 days, so the anchor is `to - 7 days`. `1M`, `3M`, `6M` and `1Y`
 * count calendar months back. `YTD` starts on 1 January of the year of `to`.
 * `ALL` starts on the UTC date of `earliestTransactionAt`. The window is not
 * clamped to the available data: that is `effectiveFrom` (§5).
 */
export function resolvePeriodWindow(
  period: PresetPeriod,
  to: Date,
  earliestTransactionAt: Date | null,
): PeriodWindow | null {
  const end = startOfUtcDay(to);

  switch (period) {
    case "1W": {
      const anchor = addUtcDays(end, -7);
      return { anchor, from: addUtcDays(anchor, 1) };
    }
    case "YTD": {
      const from = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
      return { anchor: addUtcDays(from, -1), from };
    }
    case "ALL": {
      if (earliestTransactionAt === null) {
        return null;
      }
      const from = startOfUtcDay(earliestTransactionAt);
      return { anchor: addUtcDays(from, -1), from };
    }
    case "1M":
    case "3M":
    case "6M":
    case "1Y": {
      const anchor = subtractUtcMonths(end, MONTH_OFFSETS[period]);
      return { anchor, from: addUtcDays(anchor, 1) };
    }
  }
}
