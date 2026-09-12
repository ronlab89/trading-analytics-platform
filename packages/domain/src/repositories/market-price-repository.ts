import type { CreateMarketPriceInput, MarketPrice } from "../entities/market-price";

/**
 * MarketPrice repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * MarketPrice is a single current-state row per asset (assetId is the
 * primary key — see schema.prisma), so this contract uses `upsert`
 * rather than separate create/update methods, matching how the row is
 * actually written in practice (each market tick overwrites the
 * previous current price).
 */
export interface MarketPriceRepository {
  /** Returns the current price for an asset, or null if none exists yet. */
  getByAssetId(assetId: string): Promise<MarketPrice | null>;

  /**
   * Batch lookup for dashboards displaying multiple assets at once.
   * Source: 07-api-spec.md §19 (GET /market/prices), which exists
   * specifically "to avoid excessive individual requests".
   */
  listByAssetIds(assetIds: string[]): Promise<MarketPrice[]>;

  /**
   * Creates or overwrites the current price for an asset.
   * Callers are expected to have already run `validateNewMarketPrice`
   * (see entities/market-price.ts) before calling this.
   */
  upsert(input: CreateMarketPriceInput): Promise<MarketPrice>;
}
