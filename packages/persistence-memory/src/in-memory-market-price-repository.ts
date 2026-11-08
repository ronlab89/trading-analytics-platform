import type { CreateMarketPriceInput, MarketPrice, MarketPriceRepository } from "@trading/domain";

/**
 * In-memory implementation of `MarketPriceRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: one current price per asset, keyed by
 * `assetId`, and `upsert` replaces the previous one.
 */
export class InMemoryMarketPriceRepository implements MarketPriceRepository {
  private readonly rows = new Map<string, MarketPrice>();

  getByAssetId(assetId: string): Promise<MarketPrice | null> {
    return Promise.resolve(this.rows.get(assetId) ?? null);
  }

  listByAssetIds(assetIds: string[]): Promise<MarketPrice[]> {
    const wanted = new Set(assetIds);

    return Promise.resolve([...this.rows.values()].filter((row) => wanted.has(row.assetId)));
  }

  upsert(input: CreateMarketPriceInput): Promise<MarketPrice> {
    const price: MarketPrice = { ...input };
    this.rows.set(price.assetId, price);

    return Promise.resolve(price);
  }
}
