import { Decimal } from "decimal.js";
import type { Transaction } from "../entities/transaction";
import { Money } from "../value-objects/money";
import { TransactionType } from "../entities/enums";
import { startOfUtcDay } from "./utc-date";

/**
 * Daily cash flows and daily return.
 * Source: docs/16-analytics-spec.md §4 and §6 (ADR-003 point 3, ADR-004 points 2 and 3).
 *
 *   B(d) = sum of BUY  (quantity x price + fees)
 *   S(d) = sum of SELL (quantity x price - fees)
 *   r(d) = (V(d) + S(d)) / (V(d-1) + B(d)) - 1
 *
 * Pure and deterministic (NFR-042): it never reads the clock or a repository.
 */

/** The fields of a transaction the flows need. The caller passes `COMPLETED` ones only. */
export type FlowEntry = Pick<Transaction, "type" | "quantity" | "price" | "fees" | "executedAt">;

/** `B(d)` and `S(d)` of one UTC day. Both are `Money`, zero on a day without trades. */
export interface DailyFlow {
  date: Date;
  bought: Money;
  sold: Money;
}

/**
 * Sums the flows of each day in `days`. Every BUY is an external inflow and every
 * SELL an external outflow (ADR-003 point 3): fees raise the inflow and lower the
 * outflow, so they reduce the return. Trades outside `days` are ignored. A trade in
 * another currency than `currency` throws `CurrencyMismatchError`.
 */
export function buildDailyFlows(
  entries: readonly FlowEntry[],
  days: readonly Date[],
  currency: string,
): DailyFlow[] {
  const flows: DailyFlow[] = days.map((date) => ({
    date,
    bought: Money.zero(currency),
    sold: Money.zero(currency),
  }));
  const indexByDay = new Map(days.map((day, index) => [day.getTime(), index]));

  for (const entry of entries) {
    const flow = flows[indexByDay.get(startOfUtcDay(entry.executedAt).getTime()) ?? -1];

    if (flow === undefined) {
      continue;
    }

    const gross = entry.price.multiply(entry.quantity);

    if (entry.type === TransactionType.BUY) {
      flow.bought = flow.bought.add(gross.add(entry.fees));
    } else {
      flow.sold = flow.sold.add(gross.subtract(entry.fees));
    }
  }

  return flows;
}

/**
 * The return of day `d` from the close of the day before, the day's flows and its
 * close. Inflows count at the start of the day and outflows at the end, so a sale
 * is measured against the capital invested.
 *
 * Returns `null` when `V(d-1) + B(d)` is zero: "no return" is not a zero return,
 * and the day is left out of the return series.
 */
export function calculateDailyReturn(
  previousValue: Money,
  flow: DailyFlow,
  value: Money,
): Decimal | null {
  const denominator = previousValue.add(flow.bought);

  if (denominator.isZero()) {
    return null;
  }

  return new Decimal(value.add(flow.sold).toString())
    .dividedBy(new Decimal(denominator.toString()))
    .minus(1);
}
