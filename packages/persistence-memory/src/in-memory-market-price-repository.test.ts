import { describe, expect, it } from "vitest";
import { MarketDataSource, Money } from "@trading/domain";
import { InMemoryMarketPriceRepository } from "./in-memory-market-price-repository.js";

function price(assetId: string, amount: string) {
  return {
    assetId,
    price: Money.of(amount, "USD"),
    previousPrice: Money.of("99", "USD"),
    change: Money.of("1", "USD"),
    changePercent: 1.01,
    source: MarketDataSource.MOCK,
    timestamp: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("InMemoryMarketPriceRepository", () => {
  it("returns the current price of an asset and null when it has none", async () => {
    const repository = new InMemoryMarketPriceRepository();
    const stored = await repository.upsert(price("a1", "100"));
    expect(await repository.getByAssetId("a1")).toEqual(stored);
    expect(await repository.getByAssetId("ghost")).toBeNull();
  });

  it("keeps one price per asset: a second upsert replaces the first", async () => {
    const repository = new InMemoryMarketPriceRepository();
    await repository.upsert(price("a1", "100"));
    const replaced = await repository.upsert(price("a1", "105"));
    expect(replaced.price).toEqual(Money.of("105", "USD"));
    expect(await repository.listByAssetIds(["a1"])).toHaveLength(1);
  });

  it("lists the prices of the given assets and skips the ones without a price", async () => {
    const repository = new InMemoryMarketPriceRepository();
    await repository.upsert(price("a1", "100"));
    await repository.upsert(price("a2", "200"));
    await repository.upsert(price("a3", "300"));
    const found = await repository.listByAssetIds(["a1", "a3", "ghost"]);
    expect(found.map((p) => p.assetId).sort()).toEqual(["a1", "a3"]);
    expect(await repository.listByAssetIds([])).toEqual([]);
  });
});
