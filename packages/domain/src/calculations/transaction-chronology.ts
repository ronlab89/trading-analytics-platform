import { TransactionType } from "../entities/enums";
import type { Transaction } from "../entities/transaction";
import { InsufficientPositionQuantityError } from "./position-recalculation";

/**
 * Chronological validation.
 * Source: docs/02-functional-requirements.md FR-018 (B0), ADR-003 point 6.
 *
 * Replays an asset's transactions in date order and rejects a candidate that
 * would make the held quantity negative at any point, whether the candidate
 * itself oversells or a later existing SELL would oversell once the candidate
 * is inserted. Pure and deterministic (NFR-042): it never reads the clock or a
 * repository.
 */

/** The fields of a transaction the replay needs. */
export type ChronologyEntry = Pick<Transaction, "type" | "quantity" | "executedAt">;

/**
 * Throws `InsufficientPositionQuantityError` when inserting `candidate` into
 * `history` leaves the held quantity negative at any point of the timeline.
 *
 * `history` is the asset's existing transactions in creation order. Entries
 * sharing an `executedAt` keep that creation order, and the candidate, being
 * the newest, goes last among them (FR-018).
 */
export function assertChronologicallyValid(
  history: readonly ChronologyEntry[],
  candidate: ChronologyEntry,
): void {
  // Array.prototype.sort is stable, so equal timestamps keep creation order.
  const timeline = [...history, candidate].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );

  let held = 0;

  for (const entry of timeline) {
    held += entry.type === TransactionType.BUY ? entry.quantity : -entry.quantity;

    if (held < 0) {
      throw new InsufficientPositionQuantityError(
        `Cannot sell ${entry.quantity.toString()} units dated ${entry.executedAt.toISOString()}: the portfolio would hold only ${(held + entry.quantity).toString()} at that point.`,
      );
    }
  }
}
