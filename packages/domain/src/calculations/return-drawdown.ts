import { Decimal } from "decimal.js";
import type { DailyReturnPoint } from "./period-performance";
import { addUtcDays } from "./utc-date";

/**
 * Drawdown on the cumulative return index.
 * Source: docs/16-analytics-spec.md §10 (ADR-004 point 9).
 *
 *   I(start) = 1,  I(d) = I(d-1) x (1 + r(d))
 *   DD(d)    = I(d) / max(I(t), t <= d) - 1
 *
 * Computed on the index, never on raw value, so purchases and sales are not
 * gains or losses. Pure and deterministic (NFR-042). Drawdowns are `Decimal`
 * fractions (`-0.2` is -20%); the presenter converts them.
 */

export interface ReturnDrawdown {
  readonly status: "OK" | "UNKNOWN";
  /** The lowest `DD(d)`, `0` when the index never falls. `null`, never `0`, when `UNKNOWN`. */
  readonly maxDrawdown: Decimal | null;
  /** `DD` of the last day. `null` when `UNKNOWN`. */
  readonly currentDrawdown: Decimal | null;
  /** The day the peak before the maximum drawdown was reached. `null` without a decline. */
  readonly peakDate: Date | null;
  /** The day the maximum drawdown was reached. `null` without a decline. */
  readonly troughDate: Date | null;
}

const UNKNOWN: ReturnDrawdown = {
  status: "UNKNOWN",
  maxDrawdown: null,
  currentDrawdown: null,
  peakDate: null,
  troughDate: null,
};

/**
 * Measures the drawdown of `returns`, the counted days in date order. A day
 * with no return leaves the index unchanged. The index starts at `1` on the day
 * before the first point, which is the peak date when the first return is a loss.
 *
 * Equal peaks keep the first: the peak changes only when the index is strictly
 * higher, and the trough only when the drawdown is strictly lower. `UNKNOWN`
 * when no day has a return, because the index then has a single point.
 */
export function calculateReturnDrawdown(returns: readonly DailyReturnPoint[]): ReturnDrawdown {
  const first = returns[0];

  if (first === undefined || returns.every((point) => point.rate === null)) {
    return UNKNOWN;
  }

  let index = new Decimal(1);
  let peak = index;
  let peakDate = addUtcDays(first.date, -1);
  let drawdown = new Decimal(0);

  let maxDrawdown = new Decimal(0);
  let worstPeakDate: Date | null = null;
  let worstTroughDate: Date | null = null;

  for (const point of returns) {
    if (point.rate !== null) {
      index = index.times(point.rate.plus(1));
    }

    if (index.greaterThan(peak)) {
      peak = index;
      peakDate = point.date;
    }

    drawdown = index.dividedBy(peak).minus(1);

    if (drawdown.lessThan(maxDrawdown)) {
      maxDrawdown = drawdown;
      worstPeakDate = peakDate;
      worstTroughDate = point.date;
    }
  }

  return {
    status: "OK",
    maxDrawdown,
    currentDrawdown: drawdown,
    peakDate: worstPeakDate,
    troughDate: worstTroughDate,
  };
}
