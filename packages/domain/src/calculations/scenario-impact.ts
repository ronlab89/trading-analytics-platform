import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import type { ScenarioChange } from "../entities/scenario";
import type { Money } from "../value-objects/money";
import { type PortfolioMetrics, calculatePortfolioMetrics } from "./portfolio-metrics";

/**
 * Scenario impact calculation.
 * Source: docs/06-architecture.md §10, docs/01-product-spec.md §15,
 * docs/02-functional-requirements.md FR-036/FR-038.
 *
 * Simulates the impact of hypothetical price changes on a portfolio
 * WITHOUT mutating the baseline — per FR-036 ("Creating a scenario
 * must not modify the baseline portfolio"). This function is purely
 * functional: it derives a new, isolated set of hypothetical positions
 * and never touches the `positions` array/objects passed in.
 *
 * DECOUPLING FROM THE `Scenario` ENTITY: this function intentionally
 * does not accept a `Scenario` entity as a parameter, only the
 * `ScenarioChange[]` (declared in entities/scenario.ts, the single
 * source of that shape). Callers pass `scenario.changes`; this module
 * stays free of any opinion about scenario status, naming or storage.
 */

export interface ScenarioImpactResult {
  readonly baseline: PortfolioMetrics;
  readonly scenario: PortfolioMetrics;
  readonly difference: {
    readonly totalValue: Money;
    readonly unrealizedPnL: Money;
  };
}

/**
 * Applies a scenario's price changes to a portfolio's positions and
 * returns baseline metrics, scenario metrics, and the difference
 * between them.
 *
 * Only `currentPrice` is adjusted per matching change — `quantity` and
 * `averageEntryPrice` are left untouched, since a scenario changes a
 * hypothetical market price, not what was actually bought. Positions
 * with no matching entry in `changes` keep their current price
 * unchanged.
 *
 * An empty `positions` array is valid (baseline and scenario both
 * resolve to zeroed metrics via `calculatePortfolioMetrics`).
 */
export function calculateScenarioImpact(
  portfolio: Portfolio,
  positions: readonly Position[],
  changes: readonly ScenarioChange[],
): ScenarioImpactResult {
  const changeByAssetId = new Map(changes.map((change) => [change.assetId, change.percentChange]));

  const scenarioPositions: Position[] = positions.map((position) => {
    const percentChange = changeByAssetId.get(position.assetId);

    if (percentChange === undefined) {
      return position;
    }

    const factor = 1 + percentChange / 100;
    return {
      ...position,
      currentPrice: position.currentPrice.multiply(factor),
    };
  });

  const baseline = calculatePortfolioMetrics(portfolio, positions);
  const scenario = calculatePortfolioMetrics(portfolio, scenarioPositions);

  return {
    baseline,
    scenario,
    difference: {
      totalValue: scenario.totalValue.subtract(baseline.totalValue),
      unrealizedPnL: scenario.unrealizedPnL.subtract(baseline.unrealizedPnL),
    },
  };
}
