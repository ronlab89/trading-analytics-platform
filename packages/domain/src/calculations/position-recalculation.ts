import type { CreateTransactionInput } from "../entities/transaction";
import { TransactionType } from "../entities/enums";
import type { Position } from "../entities/position";
import type { Money } from "../value-objects/money";

/**
 * Position recalculation.
 * Source: docs/02-functional-requirements.md FR-017 (transaction
 * creation workflow: "Position recalculated"), docs/05-data-model.md §8.
 *
 * This is the weighted-average-cost accounting logic that determines
 * how a new transaction changes a portfolio's position in an asset. It
 * is intentionally isolated here as a pure, deterministic function
 * (NFR-042) rather than living inline in an application service, so it
 * can be tested independently of Prisma, Express, or any repository.
 *
 * Scope: only BUY and SELL are handled, matching the transaction types
 * currently supported by TransactionType (01-product-spec.md §8 lists
 * DIVIDEND/FEE/DEPOSIT/WITHDRAWAL as future types, not yet modeled).
 */

export class InsufficientPositionQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPositionQuantityError";
  }
}

/**
 * Result of recalculating a position after a transaction.
 *
 * `null` means the position should be closed (removed) — this happens
 * when a SELL exactly exhausts the held quantity. Callers are
 * responsible for translating this into the appropriate repository
 * call (`deleteByPortfolioAndAsset` vs `upsert`).
 */
export type PositionRecalculationResult = {
  quantity: number;
  averageEntryPrice: Money;
  currentPrice: Money;
} | null;

/**
 * Calculates the resulting position state after applying a transaction.
 *
 * `existingPosition` is `null` when the portfolio currently holds no
 * position in this asset (first trade in that asset).
 *
 * BUY: increases quantity. When a position already exists, the new
 * average entry price is the standard weighted-average cost:
 *
 *   newAvgPrice = (existingQty * existingAvgPrice + txQty * txPrice)
 *                 / (existingQty + txQty)
 *
 * `currentPrice` is left untouched on an existing position — it tracks
 * market data (FR-045), not the price of our own trade. It is only
 * seeded from the transaction price when a position is newly opened,
 * since no market price is known yet at that point.
 *
 * SELL: decreases quantity. `averageEntryPrice` of the remaining shares
 * does not change (standard weighted-average-cost accounting — selling
 * some shares does not change what the remaining shares cost). Selling
 * more than the held quantity, or selling with no existing position, is
 * a business-rule violation (`InsufficientPositionQuantityError`, not a
 * transport/shape validation error). Selling exactly the held quantity
 * closes the position (returns `null`).
 */
export function calculatePositionAfterTransaction(
  existingPosition: Position | null,
  transaction: CreateTransactionInput,
): PositionRecalculationResult {
  if (transaction.type === TransactionType.BUY) {
    if (!existingPosition) {
      return {
        quantity: transaction.quantity,
        averageEntryPrice: transaction.price,
        currentPrice: transaction.price,
      };
    }

    const newQuantity = existingPosition.quantity + transaction.quantity;

    const existingCost = existingPosition.averageEntryPrice.multiply(existingPosition.quantity);
    const incomingCost = transaction.price.multiply(transaction.quantity);
    const newAverageEntryPrice = existingCost.add(incomingCost).divide(newQuantity);

    return {
      quantity: newQuantity,
      averageEntryPrice: newAverageEntryPrice,
      currentPrice: existingPosition.currentPrice,
    };
  }

  // TransactionType.SELL
  if (!existingPosition) {
    throw new InsufficientPositionQuantityError(
      "Cannot sell an asset the portfolio does not currently hold.",
    );
  }

  if (transaction.quantity > existingPosition.quantity) {
    throw new InsufficientPositionQuantityError(
      `Cannot sell ${transaction.quantity.toString()} units: portfolio only holds ${existingPosition.quantity.toString()}.`,
    );
  }

  const remainingQuantity = existingPosition.quantity - transaction.quantity;

  if (remainingQuantity === 0) {
    return null;
  }

  return {
    quantity: remainingQuantity,
    averageEntryPrice: existingPosition.averageEntryPrice,
    currentPrice: existingPosition.currentPrice,
  };
}
