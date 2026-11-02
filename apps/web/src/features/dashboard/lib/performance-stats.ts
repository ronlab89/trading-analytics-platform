import type { PerformanceResponse } from "@trading/contracts";

/** One day of the performance series: the portfolio value and its daily return in percentage points. */
export type PerformancePoint = PerformanceResponse["series"][number];

export interface DayReturn {
  date: string;
  percent: number;
}

export interface DailyStats {
  best: DayReturn;
  worst: DayReturn;
  /** Share of the days with a return that closed above zero, 0 to 100. */
  positiveDaysPercent: number;
  /** Mean of the daily returns, in percentage points. */
  averagePercent: number;
  /** How many days in a row, up to the last one, moved in the same direction. */
  streak: { direction: "up" | "down" | "flat"; days: number };
}

export interface MonthReturn {
  /** `YYYY-MM`. */
  month: string;
  /** The daily returns of the month compounded, in percentage points. */
  percent: number;
}

function directionOf(percent: number): "up" | "down" | "flat" {
  if (percent > 0) return "up";
  if (percent < 0) return "down";
  return "flat";
}

function daysWithReturn(series: readonly PerformancePoint[]): DayReturn[] {
  return series.flatMap(({ date, returnPercent }) =>
    returnPercent === null ? [] : [{ date, percent: returnPercent }],
  );
}

/**
 * The figures under the daily returns chart. Days without a return (no data yet) are left out of
 * every figure. It is null when no day has one, so the panel can say there is nothing to show.
 */
export function dailyStats(series: readonly PerformancePoint[]): DailyStats | null {
  const days = daysWithReturn(series);
  const [first] = days;
  const last = days.at(-1);
  if (first === undefined || last === undefined) return null;

  let best = first;
  let worst = first;
  let positive = 0;
  let sum = 0;
  for (const day of days) {
    if (day.percent > best.percent) best = day;
    if (day.percent < worst.percent) worst = day;
    if (day.percent > 0) positive += 1;
    sum += day.percent;
  }

  const direction = directionOf(last.percent);
  let streakDays = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (directionOf(days[i]?.percent ?? 0) !== direction) break;
    streakDays += 1;
  }

  return {
    best,
    worst,
    positiveDaysPercent: (positive / days.length) * 100,
    averagePercent: sum / days.length,
    streak: { direction, days: streakDays },
  };
}

/** The return of each calendar month of the series, compounding its daily returns, oldest first. */
export function monthlyReturns(series: readonly PerformancePoint[]): MonthReturn[] {
  const growth = new Map<string, number>();
  for (const { date, percent } of daysWithReturn(series)) {
    const month = date.slice(0, 7);
    growth.set(month, (growth.get(month) ?? 1) * (1 + percent / 100));
  }
  return [...growth].map(([month, factor]) => ({ month, percent: (factor - 1) * 100 }));
}
