import {
  calculateAllocation,
  calculateAttribution,
  calculatePortfolioMetrics,
} from "@trading/domain";
import type {
  Asset,
  AttributionItem,
  Money,
  Portfolio,
  Position,
  PositionRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { AssetService } from "./asset-service.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

export type AllocationGroupBy = "asset" | "assetType" | "currency";

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
 * Pure: allocation of already-loaded positions. Shared by the analytics
 * use cases and the portfolio overview so both derive from one code path.
 * Cross-currency portfolios surface `CurrencyMismatchError` from the
 * domain (no FX conversion exists yet, so they are unsupported rather
 * than silently miscalculated).
 */
export function buildAllocation(
  positions: readonly Position[],
  assetsById: ReadonlyMap<string, Asset>,
  groupBy: AllocationGroupBy,
): AllocationResult {
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
 * Pure: each position's contribution to unrealized P/L.
 * Scope is unrealized P/L only (see calculations/attribution.ts): fees
 * and realized results need a transaction-aware calculation that does
 * not exist yet.
 */
export function buildAttribution(
  portfolio: Portfolio,
  positions: readonly Position[],
  assetsById: ReadonlyMap<string, Asset>,
): AttributionResult {
  const items = calculateAttribution(portfolio, positions).map((item) => ({
    ...item,
    symbol: assetsById.get(item.assetId)?.symbol ?? item.assetId,
    name: assetsById.get(item.assetId)?.name ?? "",
  }));

  const { unrealizedPnL } = calculatePortfolioMetrics(portfolio, positions);

  return { totalUnrealizedPnL: unrealizedPnL, items };
}

export interface AnalyticsServiceDependencies {
  positionRepository: Pick<PositionRepository, "listByPortfolioId">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  assetService: Pick<AssetService, "getAssetsByIds">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Portfolio analytics use cases.
 * Source: FR-027, FR-030/FR-031, 07-api-spec.md §20 and §22.
 *
 * Ownership is enforced through the portfolio service (404 on mismatch,
 * same anti-enumeration behavior as the rest of the API).
 */
export function createAnalyticsService(dependencies: AnalyticsServiceDependencies) {
  const {
    positionRepository,
    portfolioService,
    assetService,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /** Portfolio allocation grouped by asset, asset type or currency. */
  async function getPortfolioAllocation(
    actor: Actor,
    portfolioId: string,
    groupBy: AllocationGroupBy,
  ): Promise<AllocationResult> {
    assertPermission(actor, "analytics:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    const positions = await positionRepository.listByPortfolioId(portfolioId);
    const assetsById = await assetService.getAssetsByIds(
      actor,
      positions.map((p) => p.assetId),
    );

    return buildAllocation(positions, assetsById, groupBy);
  }

  /**
   * Each position's contribution to the portfolio's unrealized P/L.
   * `from`/`to`/`groupBy` from the spec are deferred until historical data
   * exists.
   */
  async function getPortfolioAttribution(
    actor: Actor,
    portfolioId: string,
  ): Promise<AttributionResult> {
    assertPermission(actor, "analytics:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    const positions = await positionRepository.listByPortfolioId(portfolioId);
    const assetsById = await assetService.getAssetsByIds(
      actor,
      positions.map((p) => p.assetId),
    );

    return buildAttribution(portfolio, positions, assetsById);
  }

  return { getPortfolioAllocation, getPortfolioAttribution };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
