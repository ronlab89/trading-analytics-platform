import { TransactionType } from "../entities/enums";
import type { Transaction } from "../entities/transaction";
import type { Money } from "../value-objects/money";
import { InsufficientPositionQuantityError } from "./position-recalculation";

/**
 * Position replay.
 * Source: docs/BACKEND-ROADMAP.md B0 (position projection rebuilt by date-order
 * replay), docs/02-functional-requirements.md FR-017 and FR-018.
 *
 * Rebuilds a position from an asset's transactions in date order, so a
 * backdated transaction gives the right `averageEntryPrice` and `openedAt`
 * whatever order the transactions were recorded in. Pure and deterministic
 * (NFR-042): it never reads the clock or a repository.
 */

/** The fields of a transaction the replay needs. */
export type ReplayEntry = Pick<Transaction, "type" | "quantity" | "price" | "fees" | "executedAt">;

/** The replayed state of an open position. `currentPrice` tracks market data and is not replayed. */
export interface ReplayedPosition {
  quantity: number;
  averageEntryPrice: Money;
  openedAt: Date;
}

/**
 * Replays `entries` and returns the resulting position, or `null` when nothing
 * is held at the end.
 *
 * `entries` is in creation order. Entries sharing an `executedAt` keep that
 * order (FR-018). Weighted-average cost: a BUY blends its price and its fees
 * into the average (ADR-004 point 15), a SELL leaves the average of the
 * remaining units untouched. A SELL
 * that empties the position closes it, and the next BUY reopens it with its own
 * price and `executedAt` as `openedAt`.
 *
 * Throws `InsufficientPositionQuantityError` when a SELL exceeds what is held at
 * its point of the timeline.
 */
export function replayPosition(entries: readonly ReplayEntry[]): ReplayedPosition | null {
  // Array.prototype.sort is stable, so equal timestamps keep creation order.
  const timeline = [...entries].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());

  let position: ReplayedPosition | null = null;

  for (const entry of timeline) {
    if (entry.type === TransactionType.BUY) {
      if (position === null) {
        position = {
          quantity: entry.quantity,
          averageEntryPrice: entry.price
            .multiply(entry.quantity)
            .add(entry.fees)
            .divide(entry.quantity),
          openedAt: entry.executedAt,
        };
        continue;
      }

      const quantity: number = position.quantity + entry.quantity;
      const cost = position.averageEntryPrice
        .multiply(position.quantity)
        .add(entry.price.multiply(entry.quantity))
        .add(entry.fees);

      position = {
        quantity,
        averageEntryPrice: cost.divide(quantity),
        openedAt: position.openedAt,
      };
      continue;
    }

    // TransactionType.SELL
    const held: number = position?.quantity ?? 0;

    if (position === null || entry.quantity > held) {
      throw new InsufficientPositionQuantityError(
        `Cannot sell ${entry.quantity.toString()} units dated ${entry.executedAt.toISOString()}: the portfolio would hold only ${held.toString()} at that point.`,
      );
    }

    const remaining = held - entry.quantity;
    position = remaining === 0 ? null : { ...position, quantity: remaining };
  }

  return position;
}
