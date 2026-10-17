import { TransactionStatus, replayRealizedPnL } from "@trading/domain";
import type { Money, Transaction } from "@trading/domain";

/**
 * The P/L realized by each SELL of a portfolio.
 * Source: 16-analytics-spec.md §12, ADR-003 point 4, ADR-004 point 15.
 *
 * Calculated when it is read, not stored: a BUY dated in the past changes the
 * average cost at every later SELL, so a stored value could go stale.
 */

/**
 * Replays the `COMPLETED` transactions of each asset in date order and returns
 * the P/L realized by every SELL, keyed by transaction id. A BUY, and any
 * transaction that is not `COMPLETED`, has no entry. `currency` is the portfolio
 * base currency. Throws `InsufficientPositionQuantityError` when the history sells
 * more than it holds, which the chronological validation (FR-018) prevents.
 */
export function buildRealizedByTransaction(
  transactions: readonly Transaction[],
  currency: string,
): Map<string, Money> {
  const byAsset = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.status !== TransactionStatus.COMPLETED) {
      continue;
    }
    byAsset.set(transaction.assetId, [...(byAsset.get(transaction.assetId) ?? []), transaction]);
  }

  const realized = new Map<string, Money>();

  for (const entries of byAsset.values()) {
    for (const sale of replayRealizedPnL(entries, currency).sales) {
      if (sale.transactionId !== undefined) {
        realized.set(sale.transactionId, sale.realizedPnL);
      }
    }
  }

  return realized;
}
