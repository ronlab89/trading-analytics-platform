import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketDataSource, Money } from "@trading/domain";
import type { MarketPriceRepository } from "@trading/domain";

export interface MarketPriceContractContext {
  readonly repository: MarketPriceRepository;
  readonly fixtures: {
    /** An existing asset whose price the suite stores. */
    readonly assetId: string;
    /** A second existing asset, to check prices are kept per asset. */
    readonly otherAssetId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `MarketPriceRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Amounts have no trailing zeros, so a stored amount reads back identical
 * whatever the storage keeps for decimals.
 */
export function marketPriceRepositoryContract(
  name: string,
  factory: () => Promise<MarketPriceContractContext>,
): void {
  describe(`${name} (MarketPriceRepository contract)`, () => {
    let context: MarketPriceContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (assetId: string, amount = "184.22") => ({
      assetId,
      price: Money.of(amount, "USD"),
      previousPrice: Money.of("181.4", "USD"),
      change: Money.of("2.82", "USD"),
      changePercent: 1.55,
      source: MarketDataSource.MOCK,
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
    });

    it("returns null for an asset that has no price", async () => {
      expect(await context.repository.getByAssetId(context.fixtures.assetId)).toBeNull();
    });

    it("creates the price on the first upsert and returns every field", async () => {
      const data = input(context.fixtures.assetId);
      const stored = await context.repository.upsert(data);
      expect(stored).toEqual(data);
      expect(await context.repository.getByAssetId(context.fixtures.assetId)).toEqual(data);
    });

    it("keeps one price per asset: a second upsert replaces the first", async () => {
      await context.repository.upsert(input(context.fixtures.assetId));
      const replaced = await context.repository.upsert(input(context.fixtures.assetId, "190"));
      expect(replaced.price).toEqual(Money.of("190", "USD"));
      expect(await context.repository.getByAssetId(context.fixtures.assetId)).toEqual(replaced);
      expect(await context.repository.listByAssetIds([context.fixtures.assetId])).toHaveLength(1);
    });

    it("keeps the price of each asset apart", async () => {
      await context.repository.upsert(input(context.fixtures.assetId));
      expect(await context.repository.getByAssetId(context.fixtures.otherAssetId)).toBeNull();
      const other = await context.repository.upsert(input(context.fixtures.otherAssetId, "50"));
      expect(other.price).toEqual(Money.of("50", "USD"));
      const first = await context.repository.getByAssetId(context.fixtures.assetId);
      expect(first?.price).toEqual(Money.of("184.22", "USD"));
    });

    it("lists the prices of the given assets and skips the ones without a price", async () => {
      await context.repository.upsert(input(context.fixtures.assetId));
      const listed = await context.repository.listByAssetIds([
        context.fixtures.assetId,
        context.fixtures.otherAssetId,
        "nonexistent-id",
      ]);
      expect(listed.map((p) => p.assetId)).toEqual([context.fixtures.assetId]);
      expect(await context.repository.listByAssetIds([])).toEqual([]);
    });
  });
}
