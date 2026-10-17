import {
  calculatePortfolioDailyChange,
  calculatePortfolioMetrics,
  calculatePortfolioPulse,
  calculatePositionMetrics,
  calculateReturnDrawdown,
  calculateReturnVolatility,
  InsufficientDataError,
} from "@trading/domain";
import type {
  Asset,
  HistoricalPriceRepository,
  MarketPrice,
  Money,
  MarketPriceRepository,
  Portfolio,
  PortfolioDailyChange,
  PortfolioMetrics,
  PortfolioPulse,
  Position,
  PositionMetrics,
  PositionRepository,
  PulseDrawdownInput,
  PulseVolatilityInput,
  Transaction,
  TransactionRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import { buildAllocation, buildAttribution } from "./analytics-service.js";
import type { AllocationResult, AttributionResult } from "./analytics-service.js";
import type { AssetService } from "./asset-service.js";
import type { Clock } from "./clock.js";
import { buildPerformanceResult } from "./performance-service.js";
import type { PerformanceResult } from "./performance-service.js";
import { buildPortfolioSeries } from "./portfolio-series.js";
import { buildRealizedByTransaction } from "./realized-sales.js";
import { buildWhatChanged } from "./what-changed.js";
import type { WhatChanged } from "./what-changed.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

const RECENT_TRANSACTIONS_LIMIT = 5;

export interface AssetSummary {
  id: string;
  symbol: string;
  name: string;
  assetType: Asset["assetType"];
}

function toAssetSummary(asset: Asset | undefined): AssetSummary | null {
  return asset
    ? { id: asset.id, symbol: asset.symbol, name: asset.name, assetType: asset.assetType }
    : null;
}

export interface PositionDailyChange {
  changeValue: MarketPrice["change"];
  changePercent: number;
}

export interface OverviewPosition {
  position: Position;
  asset: AssetSummary | null;
  metrics: PositionMetrics;
  /** Share of the portfolio's total market value, in percent. */
  allocationPercent: number;
  /** Null when no current market price exists yet for this asset. */
  dailyChange: PositionDailyChange | null;
}

export interface OverviewTransaction {
  transaction: Transaction;
  /** The P/L this SELL realized; `null` for a BUY. */
  realizedPnL: Money | null;
  asset: AssetSummary | null;
}

export interface PortfolioOverview {
  portfolio: Portfolio;
  summary: PortfolioMetrics;
  positions: OverviewPosition[];
  allocation: AllocationResult;
  attribution: AttributionResult;
  recentTransactions: OverviewTransaction[];
  /**
   * Null only when the portfolio holds positions but none of them have
   * current market price data yet (InsufficientDataError). An empty
   * portfolio still gets a zeroed, non-null result.
   */
  dailyChange: PortfolioDailyChange | null;
  /** The last month of the portfolio's value, as in `GET .../analytics/performance?period=1M`. */
  performance: PerformanceResult;
  pulse: PortfolioPulse;
  /** What changed over the same `1M` period, from the same series as `performance`. */
  whatChanged: WhatChanged;
}

export interface OverviewServiceDependencies {
  positionRepository: Pick<PositionRepository, "listByPortfolioId">;
  transactionRepository: Pick<
    TransactionRepository,
    "listByPortfolioId" | "listCompletedByPortfolioId"
  >;
  marketPriceRepository: Pick<MarketPriceRepository, "listByAssetIds">;
  historicalPriceRepository: Pick<HistoricalPriceRepository, "listByAssetIds">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  assetService: Pick<AssetService, "getAssetsByIds">;
  /** The only source of "now": nothing here calls `new Date()` (ADR-001 point 8). */
  clock: Clock;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Purpose-specific read model for the dashboard.
 * Source: FR-004 (Display Portfolio Overview), 07-api-spec.md §11.
 *
 * Exists so the dashboard does not have to orchestrate many unrelated
 * requests. All figures are derived from the same positions snapshot
 * through the domain calculations (single source of truth, NFR-036).
 *
 * `performance` (FR-025/026) is the same result as the performance
 * endpoint for the fixed `1M` period (07-api-spec.md §11). `whatChanged`
 * (FR-006) covers that same period and is built from the same series.
 */
export function createOverviewService(dependencies: OverviewServiceDependencies) {
  const {
    positionRepository,
    transactionRepository,
    marketPriceRepository,
    portfolioService,
    assetService,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /**
   * Volatility and drawdown of the portfolio's own daily series over a
   * trailing `1Y` window ending on the last closed day, to feed Portfolio
   * Pulse's optional dimensions (ADR-004 point 11, 16-analytics-spec.md §15).
   * With less history the window is clamped to `effectiveFrom`; a measure
   * without enough returns is left out and Pulse renders it as "UNKNOWN"
   * rather than fabricating a value.
   */
  async function getPulseInputs(
    portfolio: Portfolio,
  ): Promise<{ volatility?: PulseVolatilityInput; drawdown?: PulseDrawdownInput }> {
    const { performance } = await buildPortfolioSeries(dependencies, portfolio, {
      kind: "preset",
      period: "1Y",
    });

    const volatility = calculateReturnVolatility(
      performance.returns.flatMap((point) => (point.rate === null ? [] : [point.rate])),
    );
    const drawdown = calculateReturnDrawdown(performance.returns);

    return {
      ...(volatility.volatilityPercent !== null
        ? { volatility: { volatilityPercent: volatility.volatilityPercent.toNumber() } }
        : {}),
      ...(drawdown.maxDrawdown !== null
        ? { drawdown: { maxDrawdownPercent: drawdown.maxDrawdown.times(100).toNumber() } }
        : {}),
    };
  }

  /** Returns the dashboard overview of one of the actor's portfolios. */
  async function getPortfolioOverview(
    actor: Actor,
    portfolioId: string,
  ): Promise<PortfolioOverview> {
    assertPermission(actor, "overview:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    const [positions, recent] = await Promise.all([
      positionRepository.listByPortfolioId(portfolioId),
      transactionRepository.listByPortfolioId(
        portfolioId,
        {},
        { page: 1, pageSize: RECENT_TRANSACTIONS_LIMIT },
      ),
    ]);

    // One series for `performance` and `whatChanged`: the period is the same.
    const series = await buildPortfolioSeries(dependencies, portfolio, {
      kind: "preset",
      period: "1M",
    });

    const assetsById = await assetService.getAssetsByIds(actor, [
      ...positions.map((p) => p.assetId),
      ...recent.items.map((t) => t.assetId),
      ...(series.inputs?.timeline.byAsset.keys() ?? []),
    ]);

    const marketPrices = await marketPriceRepository.listByAssetIds(
      positions.map((p) => p.assetId),
    );
    const marketPricesByAssetId = new Map(marketPrices.map((mp) => [mp.assetId, mp]));

    const allocation = buildAllocation(positions, assetsById, "asset");
    // With groupBy "asset", each group's key is the assetId.
    const percentByAssetId = new Map(allocation.groups.map((g) => [g.key, g.percentage]));

    let dailyChange: PortfolioDailyChange | null;
    try {
      dailyChange = calculatePortfolioDailyChange(portfolio, positions, marketPricesByAssetId);
    } catch (error) {
      if (!(error instanceof InsufficientDataError)) {
        throw error;
      }
      dailyChange = null;
    }

    const realized = buildRealizedByTransaction(
      await transactionRepository.listCompletedByPortfolioId(portfolioId),
      portfolio.baseCurrency,
    );
    const pulseInputs = await getPulseInputs(portfolio);
    const performance = buildPerformanceResult(series);

    return {
      portfolio,
      summary: calculatePortfolioMetrics(portfolio, positions),
      positions: positions.map((position) => {
        const marketPrice = marketPricesByAssetId.get(position.assetId);
        return {
          position,
          asset: toAssetSummary(assetsById.get(position.assetId)),
          metrics: calculatePositionMetrics(position),
          allocationPercent: percentByAssetId.get(position.assetId) ?? 0,
          dailyChange: marketPrice
            ? {
                changeValue: marketPrice.change.multiply(position.quantity),
                changePercent: marketPrice.changePercent,
              }
            : null,
        };
      }),
      allocation,
      attribution: buildAttribution(portfolio, positions, assetsById),
      recentTransactions: recent.items.map((transaction) => ({
        transaction,
        realizedPnL: realized.get(transaction.id) ?? null,
        asset: toAssetSummary(assetsById.get(transaction.assetId)),
      })),
      dailyChange,
      performance,
      pulse: calculatePortfolioPulse(portfolio, positions, pulseInputs),
      whatChanged: buildWhatChanged(series, assetsById, portfolio.baseCurrency),
    };
  }

  return { getPortfolioOverview };
}

export type OverviewService = ReturnType<typeof createOverviewService>;
