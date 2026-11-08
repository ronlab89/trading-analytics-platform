import { calculateRangeAttribution, groupContributions } from "@trading/domain";
import type { HistoricalPriceRepository, Money, TransactionRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import type { AssetService } from "./asset-service.js";
import type { Clock } from "./clock.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";
import { buildPortfolioSeries, type SeriesTimingOptions } from "./portfolio-series.js";
import type { AnalyticsPeriod } from "./portfolio-series.js";

export type RangeAttributionGroupBy = "asset" | "assetType";

/** The contribution of one group (an asset, or an asset type) to the period P/L. */
export interface RangeAttributionGroup {
  /** The `assetId` for `asset`, the asset type for `assetType`. */
  key: string;
  /** The symbol for `asset`, the asset type for `assetType`. */
  label: string;
  contribution: Money;
}

export interface RangeAttributionResult {
  /** The effective end date: `to` clamped to the last closed UTC day. */
  asOf: Date;
  /** The first day on which every held asset has a price (§5 clamp). */
  effectiveFrom: Date | null;
  status: "OK" | "INSUFFICIENT_DATA";
  groupBy: RangeAttributionGroupBy;
  /** The period P/L, which the groups add up to. `null` when `INSUFFICIENT_DATA`. */
  pnl: Money | null;
  groups: RangeAttributionGroup[];
}

export interface RangeAttributionServiceDependencies extends SeriesTimingOptions {
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  assetService: Pick<AssetService, "getAssetsByIds">;
  transactionRepository: Pick<TransactionRepository, "listCompletedByPortfolioId">;
  historicalPriceRepository: Pick<HistoricalPriceRepository, "listByAssetIds">;
  clock: Clock;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Range attribution use case.
 * Source: 07-api-spec.md §22, 16-analytics-spec.md §14, ADR-004 point 10.
 *
 * Splits the P/L of the period's value series (`buildPortfolioSeries`) into the
 * contribution of each asset, or of each asset type, in money only.
 */
export function createRangeAttributionService(dependencies: RangeAttributionServiceDependencies) {
  const { portfolioService, assetService, permissions = ROLE_PERMISSIONS } = dependencies;

  async function getRangeAttribution(
    actor: Actor,
    portfolioId: string,
    query: AnalyticsPeriod,
    groupBy: RangeAttributionGroupBy,
  ): Promise<RangeAttributionResult> {
    assertPermission(actor, "analytics:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    const { asOf, performance, inputs } = await buildPortfolioSeries(
      dependencies,
      portfolio,
      query,
    );

    if (inputs === null) {
      return {
        asOf,
        effectiveFrom: null,
        status: performance.status,
        groupBy,
        pnl: performance.pnl,
        groups: [],
      };
    }

    const attribution = calculateRangeAttribution(
      inputs.timeline,
      inputs.candles,
      inputs.transactions,
      portfolio.baseCurrency,
    );
    const assetsById = await assetService.getAssetsByIds(actor, [
      ...inputs.timeline.byAsset.keys(),
    ]);

    const groups =
      groupBy === "asset"
        ? attribution.contributions.map(({ assetId, contribution }) => ({
            key: assetId,
            label: assetsById.get(assetId)?.symbol ?? assetId,
            contribution,
          }))
        : groupContributions(
            attribution.contributions,
            (assetId) => assetsById.get(assetId)?.assetType ?? "UNKNOWN",
          ).map(({ key, contribution }) => ({ key, label: key, contribution }));

    return {
      asOf,
      effectiveFrom: attribution.effectiveFrom,
      status: attribution.status,
      groupBy,
      pnl: attribution.pnl,
      groups,
    };
  }

  return { getRangeAttribution };
}

export type RangeAttributionService = ReturnType<typeof createRangeAttributionService>;
