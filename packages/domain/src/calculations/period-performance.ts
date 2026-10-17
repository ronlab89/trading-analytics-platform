import { Decimal } from "decimal.js";
import { Money } from "../value-objects/money";
import { calculateDailyReturn } from "./daily-return";
import type { DailyFlow } from "./daily-return";
import type { DailyValue } from "./value-series";

/**
 * Period return and period P/L.
 * Source: docs/16-analytics-spec.md §5 and §7 (ADR-004 points 4, 6 and 7).
 *
 *   TWR = product over the days with a return of (1 + r(d)) - 1
 *   P/L = V(to) - V(base) - sum of F(d) over the days after the base
 *
 * Pure and deterministic (NFR-042): it never reads the clock or a repository.
 * Returns are `Decimal` fractions (`0.1` is +10%); the presenter converts them.
 */

/** `r(d)` of one counted day. `rate` is `null` on a day with no return. */
export interface DailyReturnPoint {
  date: Date;
  rate: Decimal | null;
}

export interface PeriodPerformance {
  /** `INSUFFICIENT_DATA` when the last day has no price. `UNKNOWN` is not produced here. */
  status: "OK" | "INSUFFICIENT_DATA";
  /** The first day on which every held asset has a price (§5); `null` without a value. */
  effectiveFrom: Date | null;
  /** `null`, not `0`, when no counted day has a return. */
  twr: Decimal | null;
  /** `null` only when `status` is `INSUFFICIENT_DATA`. */
  pnl: Money | null;
  /** The days that count for `twr` and `pnl`, in date order. */
  returns: DailyReturnPoint[];
}

/**
 * Measures a period from its daily values and flows.
 *
 * `values[0]` is the baseline day `V(from - 1)` and the rest are the days of the
 * period up to `to`; `flows` covers the same days. The flows of the baseline day
 * are ignored, because `V(base)` already includes them (they are counted once).
 *
 * The period is clamped (§5) to the longest run of priced days that ends on `to`:
 * its first day becomes the baseline, and its flows and `r(d)` are left out. A
 * single priced day leaves `effectiveFrom = to`, no TWR and a zero P/L. When
 * `to` itself has no price the result is `INSUFFICIENT_DATA` with no values. An
 * empty series is an empty portfolio: zero P/L and no TWR (FR-058).
 *
 * Throws `RangeError` when `values` and `flows` do not cover the same days.
 */
export function calculatePeriodPerformance(
  values: readonly DailyValue[],
  flows: readonly DailyFlow[],
  currency: string,
): PeriodPerformance {
  if (values.length !== flows.length) {
    throw new RangeError("The values and the flows must cover the same days.");
  }

  if (values.length === 0) {
    return { status: "OK", effectiveFrom: null, twr: null, pnl: Money.zero(currency), returns: [] };
  }

  // The closes of the trailing run of priced days, oldest first.
  const run: Money[] = [];
  for (let index = values.length - 1; index >= 0; index--) {
    const close = values[index]?.status === "OK" ? values[index]?.value : null;
    if (close === null || close === undefined) {
      break;
    }
    run.unshift(close);
  }

  const baselineValue = run[0];
  const lastValue = run[run.length - 1];

  if (baselineValue === undefined || lastValue === undefined) {
    return { status: "INSUFFICIENT_DATA", effectiveFrom: null, twr: null, pnl: null, returns: [] };
  }

  const baseline = values.length - run.length;
  const returns: DailyReturnPoint[] = [];
  let netFlow = Money.zero(currency);
  let growth = new Decimal(1);
  let hasReturn = false;

  for (let offset = 1; offset < run.length; offset++) {
    const flow = flows[baseline + offset];
    const previous = run[offset - 1];
    const current = run[offset];

    if (flow === undefined || previous === undefined || current === undefined) {
      continue;
    }

    netFlow = netFlow.add(flow.bought).subtract(flow.sold);

    const rate = calculateDailyReturn(previous, flow, current);
    returns.push({ date: flow.date, rate });

    if (rate !== null) {
      growth = growth.times(rate.plus(1));
      hasReturn = true;
    }
  }

  // Unclamped, the baseline is the day before `from`; the period starts the next day.
  const start = baseline === 0 ? Math.min(1, values.length - 1) : baseline;

  return {
    status: "OK",
    effectiveFrom: values[start]?.date ?? null,
    twr: hasReturn ? growth.minus(1) : null,
    pnl: lastValue.subtract(baselineValue).subtract(netFlow),
    returns,
  };
}
