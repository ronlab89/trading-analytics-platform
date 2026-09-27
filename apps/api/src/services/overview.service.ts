import {
  PrismaHistoricalPriceRepository,
  PrismaMarketPriceRepository,
  PrismaPositionRepository,
  PrismaTransactionRepository,
} from "@trading/database";
import {
  calculateAllocation,
  calculateDrawdown,
  calculatePortfolioDailyChange,
  calculatePortfolioMetrics,
  calculatePortfolioPulse,
  calculatePositionMetrics,
  calculateVolatility,
  InsufficientDataError,
  type Asset,
  type DrawdownResult,
  type MarketPrice,
  type Portfolio,
  type PortfolioDailyChange,
  type PortfolioMetrics,
  type PortfolioPulse,
  type Position,
  type PositionMetrics,
  type Transaction,
  type VolatilityResult,
} from "@trading/domain";
import {
  buildAllocation,
  buildAttribution,
  type AllocationResult,
  type AttributionResult,
} from "./analytics.service.js";
import { getAssetsByIds } from "./asset.service.js";
import { getPortfolioById } from "./portfolio.service.js";

const positionRepository = new PrismaPositionRepository();
const transactionRepository = new PrismaTransactionRepository();
const marketPriceRepository = new PrismaMarketPriceRepository();
const historicalPriceRepository = new PrismaHistoricalPriceRepository();

const RECENT_TRANSACTIONS_LIMIT = 5;

/**
 * Wide enough to include the entire seeded historical series regardless
 * of the real wall-clock date the server happens to run on, without
 * hardcoding a window relative to "now" (see seed/data/historical-prices.ts,
 * which seeds a fixed ~90-day range ending 2026-09-14).
 */
const HISTORICAL_PRICE_EPOCH = new Date(0);

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
  pulse: PortfolioPulse;
}

/**
 * Computes volatility/drawdown for the portfolio's largest-weight
 * asset, to feed Portfolio Pulse's optional dimensions. Both
 * `calculateVolatility`/`calculateDrawdown` operate at asset level only
 * (see their module docs) — using the largest holding is the same
 * concentration-driven proxy already used for the "concentration"
 * dimension itself, not a portfolio-level calculation.
 *
 * Returns `{}` (both undefined) when there are no positions, or when
 * the largest asset has too little historical data — Portfolio Pulse
 * already renders these as "UNKNOWN" rather than fabricating a value.
 */
async function getPulseInputs(
  positions: readonly Position[],
): Promise<{ volatility?: VolatilityResult; drawdown?: DrawdownResult }> {
  if (positions.length === 0) {
    return {};
  }

  const allocation = calculateAllocation(positions, (p) => p.assetId);
  const largest = allocation.reduce((max, group) =>
    group.percentage > max.percentage ? group : max,
  );

  const candles = await historicalPriceRepository.listByAssetId(
    largest.key,
    HISTORICAL_PRICE_EPOCH,
    new Date(),
  );

  let volatility: VolatilityResult | undefined;
  let drawdown: DrawdownResult | undefined;

  try {
    volatility = calculateVolatility(candles);
  } catch (error) {
    if (!(error instanceof InsufficientDataError)) {
      throw error;
    }
  }

  try {
    drawdown = calculateDrawdown(candles);
  } catch (error) {
    if (!(error instanceof InsufficientDataError)) {
      throw error;
    }
  }

  return {
    ...(volatility !== undefined ? { volatility } : {}),
    ...(drawdown !== undefined ? { drawdown } : {}),
  };
}

/**
 * Purpose-specific read model for the dashboard.
 * Source: FR-004 (Display Portfolio Overview), 07-api-spec.md §11.
 *
 * Exists so the dashboard does not have to orchestrate many unrelated
 * requests. All figures are derived from the same positions snapshot
 * through the domain calculations (single source of truth, NFR-036).
 *
 * `performance` (FR-025/026, historical performance by period) remains
 * deliberately omitted: it requires reconstructing the portfolio's
 * value over time from Transaction[], a distinct piece of design not
 * yet built (unlike dailyChange/pulse, which only needed MarketPrice/
 * HistoricalPrice data that now exists).
 *
 * Ownership is enforced through `getPortfolioById` (404 on mismatch).
 */
export async function getPortfolioOverview(
  userId: string,
  portfolioId: string,
): Promise<PortfolioOverview> {
  const portfolio = await getPortfolioById(userId, portfolioId);

  const [positions, recent] = await Promise.all([
    positionRepository.listByPortfolioId(portfolioId),
    transactionRepository.listByPortfolioId(
      portfolioId,
      {},
      { page: 1, pageSize: RECENT_TRANSACTIONS_LIMIT },
    ),
  ]);

  const assetsById = await getAssetsByIds([
    ...positions.map((p) => p.assetId),
    ...recent.items.map((t) => t.assetId),
  ]);

  const marketPrices = await marketPriceRepository.listByAssetIds(positions.map((p) => p.assetId));
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

  const pulseInputs = await getPulseInputs(positions);

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
      asset: toAssetSummary(assetsById.get(transaction.assetId)),
    })),
    dailyChange,
    pulse: calculatePortfolioPulse(portfolio, positions, pulseInputs),
  };
}
