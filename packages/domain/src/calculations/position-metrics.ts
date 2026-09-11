import type { Position } from "../entities/position";
import type { Money } from "../value-objects/money";

/**
 * Position metrics calculations.
 * Source: docs/06-architecture.md §10, docs/05-data-model.md §25.
 *
 * Derives values from a Position record. Position itself only holds
 * structural state (see entities/position.ts) — this module is where
 * "how a position is calculated" actually lives.
 *
 * Scope note: allocation is intentionally NOT calculated here, since
 * it requires the portfolio's total value (see calculatePortfolioMetrics
 * / calculateAllocation, next in the implementation order). Price
 * change is also out of scope here — Position has no `previousPrice`
 * field; that would come from MarketPrice, not Position.
 */

export interface PositionMetrics {
  readonly marketValue: Money;
  readonly costBasis: Money;
  readonly unrealizedPnL: Money;
  readonly unrealizedPnLPercent: number;
}

export class PositionMetricsCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositionMetricsCalculationError";
  }
}

/**
 * Calculates derived metrics for a single position.
 *
 * Assumes `position` already satisfies the structural invariants
 * enforced by `validateNewPosition` (positive quantity, positive
 * prices, matching currencies) — this function does not re-validate
 * those invariants, it only guards against the specific edge case
 * (zero cost basis) that would make a percentage calculation
 * meaningless.
 */
export function calculatePositionMetrics(position: Position): PositionMetrics {
  const marketValue = position.currentPrice.multiply(position.quantity);
  const costBasis = position.averageEntryPrice.multiply(position.quantity);

  if (costBasis.isZero()) {
    throw new PositionMetricsCalculationError(
      "Cannot calculate unrealized P/L percent from a zero cost basis.",
    );
  }

  // Money.subtract() enforces matching currencies internally, so no
  // separate currency check is duplicated here.
  const unrealizedPnL = marketValue.subtract(costBasis);
  const unrealizedPnLPercent = (unrealizedPnL.toNumber() / costBasis.toNumber()) * 100;

  return {
    marketValue,
    costBasis,
    unrealizedPnL,
    unrealizedPnLPercent,
  };
}
