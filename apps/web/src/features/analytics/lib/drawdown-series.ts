import type { PerformanceResponse } from "@trading/contracts";

/** One day of the drawdown chart: how far the portfolio is below its previous high, in percentage points (0 or less). */
export interface DrawdownPoint {
  /** `YYYY-MM-DD`. */
  date: string;
  drawdown: number;
}

export interface DrawdownSummary {
  /** The deepest day: the lowest drawdown and when it happened. */
  deepest: DrawdownPoint;
  /** Where the period ends. */
  end: DrawdownPoint;
}

/**
 * The drawdown of each day, worked out from the daily returns of the performance series. The
 * returns are chained into a cumulative index that starts at 1 on the first day, as the API does
 * for the maximum drawdown (ADR-004), and each day is compared with the highest the index has
 * been so far: `index / peak - 1`. A day without a return (null) leaves the index where it was.
 * It is null when there are fewer than two days, because one point draws no line.
 */
export function toDrawdownSeries(
  series: readonly PerformanceResponse["series"][number][],
): DrawdownPoint[] | null {
  if (series.length < 2) return null;

  let index = 1;
  let peak = 1;
  return series.map(({ date, returnPercent }) => {
    if (returnPercent !== null) index *= 1 + returnPercent / 100;
    if (index > peak) peak = index;
    // Written as a number and not as -0, so a day at the high reads as 0.
    const drawdown = (index / peak - 1) * 100;
    return { date, drawdown: drawdown === 0 ? 0 : drawdown };
  });
}

/** The figures a screen reader gets in place of the chart. */
export function summarizeDrawdown(points: readonly DrawdownPoint[]): DrawdownSummary {
  const [first] = points;
  const end = points.at(-1);
  if (first === undefined || end === undefined) {
    throw new Error("A summary needs at least one point");
  }
  let deepest = first;
  for (const point of points) {
    if (point.drawdown < deepest.drawdown) deepest = point;
  }
  return { deepest, end };
}
