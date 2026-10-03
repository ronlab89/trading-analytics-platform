import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import type { ScenarioChange } from "../entities/scenario";
import type { Money } from "../value-objects/money";
import { calculateAllocation } from "./allocation";
import { type PortfolioMetrics, calculatePortfolioMetrics } from "./portfolio-metrics";
import { applyScenarioChanges } from "./scenario-impact";

/**
 * Scenario comparison.
 * Source: docs/01-product-spec.md §15.2 (Scenario Comparison),
 * docs/02-functional-requirements.md FR-042.
 *
 * §15.2 asks for "meaningful differences rather than only displaying
 * separate charts". Portfolio totals alone cannot say WHICH asset
 * explains a difference or HOW the allocation shifts, so for each
 * scenario this also reports, per asset, the value, its difference
 * from the baseline, its allocation and the allocation shift.
 *
 * Pure and read-only: no input is mutated, so the baseline cannot be
 * changed by a comparison (FR-036, §15.1). Shared by the API and,
 * later, the demo (NFR-036).
 *
 * Everything here is derived from the same positions and the same
 * `applyScenarioChanges` / `calculateAllocation` / `calculatePortfolioMetrics`
 * used elsewhere: nothing is estimated. Allocation is per asset only
 * (not by asset type or sector). Positions in different currencies make
 * `Money` throw `CurrencyMismatchError`, which propagates to the
 * application layer (06-architecture.md §29).
 */

/** What a scenario is reduced to for comparison: an id and its changes. */
export interface ScenarioToCompare {
  readonly id: string;
  readonly changes: readonly ScenarioChange[];
}

export interface BaselineAssetRow {
  readonly assetId: string;
  readonly value: Money;
  /** Share of the portfolio's total value, 0-100. */
  readonly allocationPercent: number;
}

export interface ScenarioAssetRow {
  readonly assetId: string;
  readonly value: Money;
  /** Scenario value minus baseline value for this asset. */
  readonly valueDifference: Money;
  /** Share of the scenario's total value, 0-100. */
  readonly allocationPercent: number;
  /** Scenario allocation minus baseline allocation, in percentage points. */
  readonly allocationShift: number;
}

export interface ScenarioComparisonEntry {
  readonly scenarioId: string;
  readonly metrics: PortfolioMetrics;
  readonly difference: {
    readonly totalValue: Money;
    /** Total value difference as a % of the baseline total; null when the baseline is zero. */
    readonly totalValuePercent: number | null;
    readonly unrealizedPnL: Money;
  };
  /** Ordered by the size of the value difference, largest first. */
  readonly assets: readonly ScenarioAssetRow[];
}

export interface ScenarioComparison {
  readonly baseline: {
    readonly metrics: PortfolioMetrics;
    /** Ordered by value, largest first. */
    readonly assets: readonly BaselineAssetRow[];
  };
  /** In the same order as the scenarios passed in. */
  readonly scenarios: readonly ScenarioComparisonEntry[];
}

function byAssetId(position: Position): string {
  return position.assetId;
}

/**
 * Compares the portfolio as it is now against each scenario applied to
 * the same positions. An empty `scenarios` list is valid and returns
 * just the baseline.
 */
export function compareScenarioImpacts(
  portfolio: Portfolio,
  positions: readonly Position[],
  scenarios: readonly ScenarioToCompare[],
): ScenarioComparison {
  const baselineMetrics = calculatePortfolioMetrics(portfolio, positions);
  const baselineGroups = calculateAllocation(positions, byAssetId);
  const baselinePercentByAsset = new Map(
    baselineGroups.map((group) => [group.key, group.percentage]),
  );
  const baselineValueByAsset = new Map(
    baselineGroups.map((group) => [group.key, group.marketValue]),
  );

  const baselineAssets: BaselineAssetRow[] = baselineGroups
    .map((group) => ({
      assetId: group.key,
      value: group.marketValue,
      allocationPercent: group.percentage,
    }))
    .sort((a, b) => b.value.toNumber() - a.value.toNumber() || a.assetId.localeCompare(b.assetId));

  const entries = scenarios.map((scenario): ScenarioComparisonEntry => {
    const scenarioPositions = applyScenarioChanges(positions, scenario.changes);
    const metrics = calculatePortfolioMetrics(portfolio, scenarioPositions);
    const totalValueDifference = metrics.totalValue.subtract(baselineMetrics.totalValue);

    const assets: ScenarioAssetRow[] = calculateAllocation(scenarioPositions, byAssetId)
      .map((group) => {
        const baselineValue = baselineValueByAsset.get(group.key);
        const baselinePercent = baselinePercentByAsset.get(group.key) ?? 0;

        return {
          assetId: group.key,
          value: group.marketValue,
          // The scenario only reprices positions, so every scenario
          // asset is also a baseline asset; the fallback keeps the
          // types honest without inventing a value.
          valueDifference: baselineValue
            ? group.marketValue.subtract(baselineValue)
            : group.marketValue,
          allocationPercent: group.percentage,
          allocationShift: group.percentage - baselinePercent,
        };
      })
      .sort(
        (a, b) =>
          Math.abs(b.valueDifference.toNumber()) - Math.abs(a.valueDifference.toNumber()) ||
          a.assetId.localeCompare(b.assetId),
      );

    return {
      scenarioId: scenario.id,
      metrics,
      difference: {
        totalValue: totalValueDifference,
        totalValuePercent: baselineMetrics.totalValue.isZero()
          ? null
          : (totalValueDifference.toNumber() / baselineMetrics.totalValue.toNumber()) * 100,
        unrealizedPnL: metrics.unrealizedPnL.subtract(baselineMetrics.unrealizedPnL),
      },
      assets,
    };
  });

  return {
    baseline: { metrics: baselineMetrics, assets: baselineAssets },
    scenarios: entries,
  };
}
