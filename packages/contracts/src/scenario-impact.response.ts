import { z } from "zod";
import { ScenarioStatus } from "@trading/domain";
import type { Money, PortfolioMetrics } from "@trading/domain";
import { portfolioMetricsResponseSchema, presentPortfolioMetrics } from "./portfolio.response.js";
import { moneySchema, presentMoney } from "./response-common.schema.js";

const scenarioStatusValues = Object.values(ScenarioStatus) as [ScenarioStatus, ...ScenarioStatus[]];

/**
 * Response shapes for POST .../scenarios/:scenarioId/calculate and
 * POST .../scenarios/compare. Nothing here is persisted: both are derived
 * on demand (05-data-model.md §16).
 * Source: 07-api-spec.md §25, FR-038, FR-042.
 */
export const scenarioCalculationResponseSchema = z.object({
  scenarioId: z.string(),
  baseline: portfolioMetricsResponseSchema,
  result: portfolioMetricsResponseSchema,
  difference: z.object({ totalValue: moneySchema, unrealizedPnL: moneySchema }),
  unmatchedAssetIds: z.array(z.string()),
});
export type ScenarioCalculationResponse = z.infer<typeof scenarioCalculationResponseSchema>;

const assetLabelShape = {
  symbol: z.string().nullable(),
  name: z.string().nullable(),
};

export const scenarioComparisonResponseSchema = z.object({
  baseline: z.object({
    metrics: portfolioMetricsResponseSchema,
    assets: z.array(
      z.object({
        assetId: z.string(),
        value: moneySchema,
        allocationPercent: z.number(),
        ...assetLabelShape,
      }),
    ),
  }),
  scenarios: z.array(
    z.object({
      scenarioId: z.string(),
      name: z.string(),
      status: z.enum(scenarioStatusValues),
      metrics: portfolioMetricsResponseSchema,
      difference: z.object({
        totalValue: moneySchema,
        totalValuePercent: z.number().nullable(),
        unrealizedPnL: moneySchema,
      }),
      assets: z.array(
        z.object({
          assetId: z.string(),
          value: moneySchema,
          valueDifference: moneySchema,
          allocationPercent: z.number(),
          allocationShift: z.number(),
          ...assetLabelShape,
        }),
      ),
      unmatchedAssetIds: z.array(z.string()),
    }),
  ),
});
export type ScenarioComparisonResponse = z.infer<typeof scenarioComparisonResponseSchema>;

interface AssetLabelSource {
  symbol: string | null;
  name: string | null;
}

/** Structural twin of the result of the API scenario calculation. */
export interface ScenarioCalculationSource {
  scenarioId: string;
  baseline: PortfolioMetrics;
  result: PortfolioMetrics;
  difference: { totalValue: Money; unrealizedPnL: Money };
  unmatchedAssetIds: readonly string[];
}

/** Structural twin of the result of the API scenario comparison. */
export interface ScenarioComparisonSource {
  baseline: {
    metrics: PortfolioMetrics;
    assets: readonly (AssetLabelSource & {
      assetId: string;
      value: Money;
      allocationPercent: number;
    })[];
  };
  scenarios: readonly {
    scenarioId: string;
    name: string;
    status: ScenarioStatus;
    metrics: PortfolioMetrics;
    difference: { totalValue: Money; totalValuePercent: number | null; unrealizedPnL: Money };
    assets: readonly (AssetLabelSource & {
      assetId: string;
      value: Money;
      valueDifference: Money;
      allocationPercent: number;
      allocationShift: number;
    })[];
    unmatchedAssetIds: readonly string[];
  }[];
}

export function presentScenarioCalculation(
  calculation: ScenarioCalculationSource,
): ScenarioCalculationResponse {
  return {
    scenarioId: calculation.scenarioId,
    baseline: presentPortfolioMetrics(calculation.baseline),
    result: presentPortfolioMetrics(calculation.result),
    difference: {
      totalValue: presentMoney(calculation.difference.totalValue),
      unrealizedPnL: presentMoney(calculation.difference.unrealizedPnL),
    },
    unmatchedAssetIds: [...calculation.unmatchedAssetIds],
  };
}

export function presentScenarioComparison(
  comparison: ScenarioComparisonSource,
): ScenarioComparisonResponse {
  return {
    baseline: {
      metrics: presentPortfolioMetrics(comparison.baseline.metrics),
      assets: comparison.baseline.assets.map((row) => ({
        assetId: row.assetId,
        value: presentMoney(row.value),
        allocationPercent: row.allocationPercent,
        symbol: row.symbol,
        name: row.name,
      })),
    },
    scenarios: comparison.scenarios.map((entry) => ({
      scenarioId: entry.scenarioId,
      name: entry.name,
      status: entry.status,
      metrics: presentPortfolioMetrics(entry.metrics),
      difference: {
        totalValue: presentMoney(entry.difference.totalValue),
        totalValuePercent: entry.difference.totalValuePercent,
        unrealizedPnL: presentMoney(entry.difference.unrealizedPnL),
      },
      assets: entry.assets.map((row) => ({
        assetId: row.assetId,
        value: presentMoney(row.value),
        valueDifference: presentMoney(row.valueDifference),
        allocationPercent: row.allocationPercent,
        allocationShift: row.allocationShift,
        symbol: row.symbol,
        name: row.name,
      })),
      unmatchedAssetIds: [...entry.unmatchedAssetIds],
    })),
  };
}
