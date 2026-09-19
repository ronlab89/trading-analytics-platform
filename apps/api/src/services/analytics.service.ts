import { PrismaAssetRepository, PrismaPositionRepository } from "@trading/database";
import {
  calculateAllocation,
  calculateAttribution,
  calculatePortfolioMetrics,
  type Asset,
  type AttributionItem,
  type Money,
  type Position,
} from "@trading/domain";
import type { AllocationGroupBy } from "../schemas/analytics.schema.js";
import { getPortfolioById } from "./portfolio.service.js";

const positionRepository = new PrismaPositionRepository();
const assetRepository = new PrismaAssetRepository();

async function loadAssetsById(positions: readonly Position[]): Promise<Map<string, Asset>> {
  const assets = await assetRepository.getByIds([...new Set(positions.map((p) => p.assetId))]);
  return new Map(assets.map((asset) => [asset.id, asset]));
}

export interface AllocationResult {
  groupBy: AllocationGroupBy;
  groups: {
    key: string;
    label: string;
    marketValue: Money;
    percentage: number;
  }[];
}

/**
 * Portfolio allocation grouped by asset, asset type or currency.
 * Source: FR-027, 07-api-spec.md §20.
 *
 * Ownership is enforced through `getPortfolioById` (404 on mismatch,
 * same anti-enumeration behavior as the rest of the API). Cross-currency
 * portfolios surface `CurrencyMismatchError` from the domain as a 500:
 * there is no FX conversion yet, so such a portfolio is unsupported
 * rather than silently miscalculated.
 */
export async function getPortfolioAllocation(
  userId: string,
  portfolioId: string,
  groupBy: AllocationGroupBy,
): Promise<AllocationResult> {
  await getPortfolioById(userId, portfolioId);

  const positions = await positionRepository.listByPortfolioId(portfolioId);
  const assetsById = await loadAssetsById(positions);

  const keyFor = (position: Position): string => {
    switch (groupBy) {
      case "asset":
        return position.assetId;
      case "assetType":
        return assetsById.get(position.assetId)?.assetType ?? "UNKNOWN";
      case "currency":
        return position.currentPrice.currency;
    }
  };

  const labelFor = (key: string): string =>
    groupBy === "asset" ? (assetsById.get(key)?.symbol ?? key) : key;

  const groups = calculateAllocation(positions, keyFor).map((group) => ({
    key: group.key,
    label: labelFor(group.key),
    marketValue: group.marketValue,
    percentage: group.percentage,
  }));

  return { groupBy, groups };
}

export interface AttributionResult {
  totalUnrealizedPnL: Money;
  items: (AttributionItem & { symbol: string; name: string })[];
}

/**
 * Each position's contribution to the portfolio's unrealized P/L.
 * Source: FR-030/FR-031, 07-api-spec.md §22.
 *
 * Scope is unrealized P/L only (see calculations/attribution.ts): fees
 * and realized results need a transaction-aware calculation that does
 * not exist yet. `from`/`to`/`groupBy` from the spec are deferred until
 * historical data exists.
 */
export async function getPortfolioAttribution(
  userId: string,
  portfolioId: string,
): Promise<AttributionResult> {
  const portfolio = await getPortfolioById(userId, portfolioId);

  const positions = await positionRepository.listByPortfolioId(portfolioId);
  const assetsById = await loadAssetsById(positions);

  const items = calculateAttribution(portfolio, positions).map((item) => ({
    ...item,
    symbol: assetsById.get(item.assetId)?.symbol ?? item.assetId,
    name: assetsById.get(item.assetId)?.name ?? "",
  }));

  const { unrealizedPnL } = calculatePortfolioMetrics(portfolio, positions);

  return { totalUnrealizedPnL: unrealizedPnL, items };
}
