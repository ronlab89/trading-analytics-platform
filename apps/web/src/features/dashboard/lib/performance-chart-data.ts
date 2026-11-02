import type { PerformancePoint } from "./performance-stats";

export interface ValuePoint {
  /** `YYYY-MM-DD`. */
  date: string;
  value: number;
}

export interface ValueSeries {
  currency: string;
  /** The days that have a value, oldest first; at least two. */
  points: ValuePoint[];
}

export interface ValueSummary {
  start: ValuePoint;
  end: ValuePoint;
  high: ValuePoint;
  low: ValuePoint;
  /** What the value changed from the first day to the last, in percentage points. */
  changePercent: number;
}

/**
 * The portfolio value of each day as numbers a chart can plot. A day without a value is left out.
 * It is null when fewer than two days remain, because one point draws no line. The amounts are only
 * plotted, never added up, so reading them as numbers loses nothing that matters.
 */
export function toValueSeries(series: readonly PerformancePoint[]): ValueSeries | null {
  const points: ValuePoint[] = [];
  let currency: string | undefined;
  for (const { date, value } of series) {
    if (value === null) continue;
    currency ??= value.currency;
    points.push({ date, value: Number(value.amount) });
  }
  if (currency === undefined || points.length < 2) return null;
  return { currency, points };
}

/** The figures a screen reader gets in place of the line: where it started, ended, peaked and dipped. */
export function summarizeSeries(points: readonly ValuePoint[]): ValueSummary {
  const [start] = points;
  const end = points.at(-1);
  if (start === undefined || end === undefined) {
    throw new Error("A summary needs at least one point");
  }
  let high = start;
  let low = start;
  for (const point of points) {
    if (point.value > high.value) high = point;
    if (point.value < low.value) low = point;
  }
  const changePercent = start.value === 0 ? 0 : ((end.value - start.value) / start.value) * 100;
  return { start, end, high, low, changePercent };
}
