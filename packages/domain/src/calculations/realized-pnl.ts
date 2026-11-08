import { TransactionType } from "../entities/enums.js";
import { Money } from "../value-objects/money.js";
import { applyBuy, applySell, assertCanSell, sortByExecutedAt } from "./position-replay.js";
import type { ReplayEntry, ReplayedPosition } from "./position-replay.js";

/**
 * Realized P/L.
 * Source: docs/16-analytics-spec.md §12 (ADR-003 point 4, ADR-004 point 15).
 *
 * Realized on each SELL against the weighted-average cost at the time of the
 * sale, net of the SELL fees:
 *
 *   realizedPnL(SELL) = quantity x (price - averageEntryPrice at the sale) - fees
 *
 * Pure and deterministic (NFR-042): it never reads the clock or a repository.
 */

/** The P/L realized by one SELL. */
export interface RealizedSale {
  /** The id of the SELL, when its entry had one. */
  transactionId?: string;
  executedAt: Date;
  quantity: number;
  realizedPnL: Money;
}

export interface RealizedPnLResult {
  /** The sum over every SELL, zero in `currency` when there are none. */
  total: Money;
  /** One entry per SELL, in date order. */
  sales: RealizedSale[];
}

/**
 * Replays `entries` in date order, with the same cost rules as `replayPosition`
 * (BUY fees in the average, a SELL leaves the average untouched), and returns
 * the P/L realized by each SELL and their total.
 *
 * `currency` is the currency of the entries; it types the zero total when there
 * is no SELL. Throws `InsufficientPositionQuantityError` when a SELL exceeds
 * what is held at its point of the timeline.
 */
export function replayRealizedPnL(
  entries: readonly ReplayEntry[],
  currency: string,
): RealizedPnLResult {
  let position: ReplayedPosition | null = null;
  let total = Money.zero(currency);
  const sales: RealizedSale[] = [];

  for (const entry of sortByExecutedAt(entries)) {
    if (entry.type === TransactionType.BUY) {
      position = applyBuy(position, entry);
      continue;
    }

    const held = assertCanSell(position, entry);
    const realizedPnL = entry.price
      .subtract(held.averageEntryPrice)
      .multiply(entry.quantity)
      .subtract(entry.fees);

    total = total.add(realizedPnL);
    sales.push({
      ...(entry.id !== undefined ? { transactionId: entry.id } : {}),
      executedAt: entry.executedAt,
      quantity: entry.quantity,
      realizedPnL,
    });
    position = applySell(held, entry);
  }

  return { total, sales };
}
