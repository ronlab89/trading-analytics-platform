import { PrismaPositionRepository, PrismaTransactionRepository } from "@trading/database";
import {
  calculatePortfolioMetrics,
  calculatePositionMetrics,
  type Asset,
  type Portfolio,
  type PortfolioMetrics,
  type Position,
  type PositionMetrics,
  type Transaction,
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

export interface OverviewPosition {
  position: Position;
  asset: AssetSummary | null;
  metrics: PositionMetrics;
  /** Share of the portfolio's total market value, in percent. */
  allocationPercent: number;
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
}

/**
 * Purpose-specific read model for the dashboard.
 * Source: FR-004 (Display Portfolio Overview), 07-api-spec.md §11.
 *
 * Exists so the dashboard does not have to orchestrate many unrelated
 * requests. All figures are derived from the same positions snapshot
 * through the domain calculations (single source of truth, NFR-036).
 *
 * Deliberately omitted until historical data exists (no fabricated
 * metrics): `performance`, `pulse`, `dailyChange`. They can be added as
 * new fields without changing the shape of the existing ones.
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

  const allocation = buildAllocation(positions, assetsById, "asset");
  // With groupBy "asset", each group's key is the assetId.
  const percentByAssetId = new Map(allocation.groups.map((g) => [g.key, g.percentage]));

  return {
    portfolio,
    summary: calculatePortfolioMetrics(portfolio, positions),
    positions: positions.map((position) => ({
      position,
      asset: toAssetSummary(assetsById.get(position.assetId)),
      metrics: calculatePositionMetrics(position),
      allocationPercent: percentByAssetId.get(position.assetId) ?? 0,
    })),
    allocation,
    attribution: buildAttribution(portfolio, positions, assetsById),
    recentTransactions: recent.items.map((transaction) => ({
      transaction,
      asset: toAssetSummary(assetsById.get(transaction.assetId)),
    })),
  };
}
