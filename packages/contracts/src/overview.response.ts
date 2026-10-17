import { z } from "zod";
import type {
  Money,
  Portfolio,
  PortfolioDailyChange,
  PortfolioMetrics,
  PortfolioPulse,
  Position,
  PositionMetrics,
  Transaction,
} from "@trading/domain";
import {
  allocationResponseSchema,
  attributionResponseSchema,
  presentAllocation,
  presentAttribution,
} from "./analytics.response.js";
import {
  portfolioMetricsResponseSchema,
  portfolioResponseSchema,
  presentPortfolio,
  presentPortfolioMetrics,
} from "./portfolio.response.js";
import {
  positionMetricsResponseSchema,
  positionResponseSchema,
  presentPosition,
  presentPositionMetrics,
} from "./position.response.js";
import { performanceResponseSchema, presentPerformance } from "./performance.response.js";
import { moneySchema, presentMoney } from "./response-common.schema.js";
import { presentTransaction, transactionResponseSchema } from "./transaction.response.js";
import { presentWhatChanged, whatChangedResponseSchema } from "./what-changed.response.js";

/**
 * Response shape for GET /api/v1/portfolios/:portfolioId/overview.
 * Source: 07-api-spec.md §11, FR-004. Composes the position, analytics and
 * transaction response schemas so there is one wire shape per concept.
 */
const assetSummaryResponseSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  assetType: z.string(),
});

function pulseDimensionSchema<T extends string>(classifications: readonly [T, ...T[]]) {
  return z.object({
    classification: z.enum(classifications),
    value: z.number().nullable(),
    explanation: z.string(),
  });
}

export const overviewResponseSchema = z.object({
  portfolio: portfolioResponseSchema,
  summary: portfolioMetricsResponseSchema,
  positions: z.array(
    z.object({
      position: positionResponseSchema,
      asset: assetSummaryResponseSchema.nullable(),
      metrics: positionMetricsResponseSchema,
      allocationPercent: z.number(),
      dailyChange: z.object({ changeValue: moneySchema, changePercent: z.number() }).nullable(),
    }),
  ),
  allocation: allocationResponseSchema,
  attribution: attributionResponseSchema,
  recentTransactions: z.array(
    z.object({
      transaction: transactionResponseSchema,
      asset: assetSummaryResponseSchema.nullable(),
    }),
  ),
  dailyChange: z
    .object({
      changeValue: moneySchema,
      changePercent: z.number(),
      excludedAssetIds: z.array(z.string()),
    })
    .nullable(),
  performance: performanceResponseSchema,
  pulse: z.object({
    performance: pulseDimensionSchema(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
    concentration: pulseDimensionSchema(["LOW", "MODERATE", "HIGH"]),
    volatility: pulseDimensionSchema(["LOW", "MODERATE", "HIGH", "UNKNOWN"]),
    drawdown: pulseDimensionSchema(["LOW", "MODERATE", "SEVERE", "UNKNOWN"]),
  }),
  whatChanged: whatChangedResponseSchema,
});
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;

interface AssetSummarySource {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
}

/** Structural twin of the read model returned by the API overview service. */
export interface OverviewSource {
  portfolio: Portfolio;
  summary: PortfolioMetrics;
  positions: readonly {
    position: Position;
    asset: AssetSummarySource | null;
    metrics: PositionMetrics;
    allocationPercent: number;
    dailyChange: { changeValue: Money; changePercent: number } | null;
  }[];
  allocation: Parameters<typeof presentAllocation>[0];
  attribution: Parameters<typeof presentAttribution>[0];
  recentTransactions: readonly { transaction: Transaction; asset: AssetSummarySource | null }[];
  dailyChange: PortfolioDailyChange | null;
  performance: Parameters<typeof presentPerformance>[0];
  pulse: PortfolioPulse;
  whatChanged: Parameters<typeof presentWhatChanged>[0];
}

function presentAssetSummary(asset: AssetSummarySource | null) {
  return asset
    ? { id: asset.id, symbol: asset.symbol, name: asset.name, assetType: asset.assetType }
    : null;
}

function presentPulseDimension<T extends string>(dimension: {
  classification: T;
  value: number | null;
  explanation: string;
}) {
  return {
    classification: dimension.classification,
    value: dimension.value,
    explanation: dimension.explanation,
  };
}

export function presentOverview(overview: OverviewSource): OverviewResponse {
  return {
    portfolio: presentPortfolio(overview.portfolio),
    summary: presentPortfolioMetrics(overview.summary),
    positions: overview.positions.map((entry) => ({
      position: presentPosition(entry.position),
      asset: presentAssetSummary(entry.asset),
      metrics: presentPositionMetrics(entry.metrics),
      allocationPercent: entry.allocationPercent,
      dailyChange: entry.dailyChange
        ? {
            changeValue: presentMoney(entry.dailyChange.changeValue),
            changePercent: entry.dailyChange.changePercent,
          }
        : null,
    })),
    allocation: presentAllocation(overview.allocation),
    attribution: presentAttribution(overview.attribution),
    recentTransactions: overview.recentTransactions.map((entry) => ({
      transaction: presentTransaction(entry.transaction),
      asset: presentAssetSummary(entry.asset),
    })),
    dailyChange: overview.dailyChange
      ? {
          changeValue: presentMoney(overview.dailyChange.changeValue),
          changePercent: overview.dailyChange.changePercent,
          excludedAssetIds: [...overview.dailyChange.excludedAssetIds],
        }
      : null,
    performance: presentPerformance(overview.performance),
    pulse: {
      performance: presentPulseDimension(overview.pulse.performance),
      concentration: presentPulseDimension(overview.pulse.concentration),
      volatility: presentPulseDimension(overview.pulse.volatility),
      drawdown: presentPulseDimension(overview.pulse.drawdown),
    },
    whatChanged: presentWhatChanged(overview.whatChanged),
  };
}
