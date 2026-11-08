import type {
  AssetRepository,
  HistoricalPrice,
  HistoricalPriceRepository,
  MarketPrice,
  MarketPriceRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";

export interface MarketServiceDependencies {
  assetRepository: Pick<AssetRepository, "getById">;
  marketPriceRepository: Pick<MarketPriceRepository, "getByAssetId" | "listByAssetIds">;
  historicalPriceRepository: Pick<HistoricalPriceRepository, "listByAssetId">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Market data use cases.
 * Source: FR-021, FR-026, FR-044, 07-api-spec.md §17-19.
 *
 * Market data is global reference data, so only the `market:read`
 * permission applies and there is no ownership check.
 */
export function createMarketService(dependencies: MarketServiceDependencies) {
  const {
    assetRepository,
    marketPriceRepository,
    historicalPriceRepository,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  async function assertAssetExists(assetId: string): Promise<void> {
    const asset = await assetRepository.getById(assetId);
    if (!asset) {
      throw new NotFoundError("The requested asset could not be found.");
    }
  }

  /**
   * Current market price for one asset (FR-021).
   *
   * Two different 404 messages: the asset does not exist, or it exists but has
   * no current price yet. Assets are public reference data, so there is no
   * anti-enumeration reason to blur the distinction.
   */
  async function getAssetPrice(actor: Actor, assetId: string): Promise<MarketPrice> {
    assertPermission(actor, "market:read", permissions);
    await assertAssetExists(assetId);

    const price = await marketPriceRepository.getByAssetId(assetId);
    if (!price) {
      throw new NotFoundError("No current price is available for this asset.");
    }

    return price;
  }

  /**
   * Batch current prices (FR-044). Never fails: unknown ids and assets without
   * a current price are absent from the result.
   */
  async function getBatchPrices(actor: Actor, assetIds: readonly string[]): Promise<MarketPrice[]> {
    assertPermission(actor, "market:read", permissions);
    return marketPriceRepository.listByAssetIds([...assetIds]);
  }

  /**
   * Daily OHLCV candles for one asset within a date range (FR-026). Only daily
   * candles exist today, so there is no interval to branch on.
   */
  async function getAssetHistory(
    actor: Actor,
    assetId: string,
    from: Date,
    to: Date,
  ): Promise<HistoricalPrice[]> {
    assertPermission(actor, "market:read", permissions);
    await assertAssetExists(assetId);

    return historicalPriceRepository.listByAssetId(assetId, from, to);
  }

  return { getAssetPrice, getBatchPrices, getAssetHistory };
}

export type MarketService = ReturnType<typeof createMarketService>;
