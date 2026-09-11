import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { Money } from "../value-objects/money";
import { calculatePositionMetrics } from "./position-metrics";

/**
 * Performance attribution calculations.
 * Source: docs/06-architecture.md §10, docs/01-product-spec.md §12,
 * docs/02-functional-requirements.md FR-030/FR-031.
 *
 * Explains how much each position contributed to the portfolio's
 * total performance — distinct from `calculateAllocation`, which
 * answers "how much is invested where", not "what drove the result".
 *
 * SCOPE (intentionally reduced vs. the full example in §12, which
 * also shows a "Fees" contributor): with only Position[] as input,
 * this function can only attribute contribution to **unrealized P/L**.
 * Attributing fees or realized P/L would require Transaction[] as an
 * input, which is not yet threaded through any domain calculation.
 * This is a deliberate limitation, not an oversight — extending
 * attribution to include fees/realized P/L is future work once a
 * transaction-aware calculation exists (see PROGRESS.md open items).
 *
 * `portfolio` is accepted as a parameter for symmetry with
 * `calculatePortfolioMetrics` and to support a future need (e.g.
 * resolving the base currency for an empty result), even though the
 * current calculation does not use its fields directly.
 */

export interface AttributionItem {
  readonly assetId: string;
  readonly contribution: Money;
  readonly percentageOfTotal: number;
}

/**
 * Calculates each position's contribution to the portfolio's total
 * unrealized P/L.
 *
 * When the total P/L is zero (e.g. an empty portfolio, or positions
 * whose gains and losses exactly offset), `percentageOfTotal` is 0 for
 * every item — there is no meaningful total to attribute against, so
 * this avoids a division-by-zero rather than fabricating a ratio.
 *
 * Positions across different currencies will cause `Money.add()` to
 * throw `CurrencyMismatchError`, allowed to propagate to the calling
 * application layer (06-architecture.md §29).
 */
export function calculateAttribution(
  portfolio: Portfolio,
  positions: readonly Position[],
): AttributionItem[] {
  if (positions.length === 0) {
    return [];
  }

  const perPositionMetrics = positions.map((position) => ({
    assetId: position.assetId,
    metrics: calculatePositionMetrics(position),
  }));

  const first = perPositionMetrics[0];
  if (!first) {
    return [];
  }
  const currency = first.metrics.unrealizedPnL.currency;

  const totalUnrealizedPnL = perPositionMetrics.reduce(
    (total, entry) => total.add(entry.metrics.unrealizedPnL),
    Money.zero(currency),
  );

  return perPositionMetrics.map(({ assetId, metrics }) => ({
    assetId,
    contribution: metrics.unrealizedPnL,
    percentageOfTotal: totalUnrealizedPnL.isZero()
      ? 0
      : (metrics.unrealizedPnL.toNumber() / totalUnrealizedPnL.toNumber()) * 100,
  }));
}
