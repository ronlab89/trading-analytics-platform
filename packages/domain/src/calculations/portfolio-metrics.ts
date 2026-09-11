import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { Money } from "../value-objects/money";
import { calculatePositionMetrics } from "./position-metrics";

/**
 * Portfolio metrics calculations.
 * Source: docs/06-architecture.md §10, docs/05-data-model.md §24.
 *
 * Aggregates PositionMetrics across a portfolio's positions.
 *
 * SCOPE (intentionally reduced vs. the full field list in §24):
 * Given only Portfolio + Position[] as inputs, this function can
 * honestly calculate `totalValue`, `investedValue`, `unrealizedPnL`
 * and `unrealizedPnLPercent`. The following fields from §24 are
 * NOT calculated here because the required inputs don't exist yet
 * in the domain model, and inventing them would violate the
 * "no fabricated metrics" principle (03-non-functional-requirements.md
 * §NFR-070, 15-implementation-plan.md §2):
 *
 *   - cashValue        → Portfolio/Position have no cash ledger concept.
 *   - dailyChange(%)    → requires a historical snapshot (out of scope
 *                         for this sub-step; belongs with drawdown).
 *   - realizedPnL       → derives from closed/settled transactions,
 *                         not from open positions.
 *   - drawdown          → its own sub-step (calculateDrawdown).
 *   - volatility        → its own sub-step (calculateVolatility).
 *
 * `totalValue` currently equals `investedValue` because there is no
 * cash component yet. The two are kept as separate fields so that
 * adding cash later does not change this function's return shape.
 *
 * Currency handling: positions are expected to share a common
 * currency for now. If they don't, `Money.add()` throws
 * `CurrencyMismatchError`, which is allowed to propagate — this is a
 * domain-level error to be handled by the calling application layer
 * (06-architecture.md §29), not something silently swallowed here.
 */

export interface PortfolioMetrics {
  readonly totalValue: Money;
  readonly investedValue: Money;
  readonly unrealizedPnL: Money;
  readonly unrealizedPnLPercent: number;
}

/**
 * Calculates aggregate metrics for a portfolio from its positions.
 *
 * An empty position list is a valid state (an empty portfolio) and
 * returns zeroed metrics denominated in the portfolio's base currency,
 * per FR-058 (Empty States).
 */
export function calculatePortfolioMetrics(
  portfolio: Portfolio,
  positions: readonly Position[],
): PortfolioMetrics {
  if (positions.length === 0) {
    const zero = Money.zero(portfolio.baseCurrency);
    return {
      totalValue: zero,
      investedValue: zero,
      unrealizedPnL: zero,
      unrealizedPnLPercent: 0,
    };
  }

  const perPositionMetrics = positions.map(calculatePositionMetrics);

  const investedValue = perPositionMetrics.reduce(
    (total, metrics) => total.add(metrics.marketValue),
    Money.zero(portfolio.baseCurrency),
  );

  const totalCostBasis = perPositionMetrics.reduce(
    (total, metrics) => total.add(metrics.costBasis),
    Money.zero(portfolio.baseCurrency),
  );

  const unrealizedPnL = investedValue.subtract(totalCostBasis);

  const unrealizedPnLPercent = totalCostBasis.isZero()
    ? 0
    : (unrealizedPnL.toNumber() / totalCostBasis.toNumber()) * 100;

  return {
    totalValue: investedValue,
    investedValue,
    unrealizedPnL,
    unrealizedPnLPercent,
  };
}
