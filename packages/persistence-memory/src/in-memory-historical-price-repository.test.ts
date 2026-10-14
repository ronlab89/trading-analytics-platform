import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { InMemoryHistoricalPriceRepository } from "./in-memory-historical-price-repository.js";

function candle(assetId: string, timestamp: Date | undefined, close = "100") {
  return {
    assetId,
    ...(timestamp !== undefined ? { timestamp } : {}),
    open: Money.of("99", "USD"),
    high: Money.of("101", "USD"),
    low: Money.of("98", "USD"),
    close: Money.of(close, "USD"),
    volume: 1000,
  };
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

describe("InMemoryHistoricalPriceRepository", () => {
  it("stores a candle with the given timestamp", async () => {
    const stored = await new InMemoryHistoricalPriceRepository().create(candle("a1", day(5)));
    expect(stored.timestamp).toEqual(day(5));
    expect(stored.volume).toBe(1000);
  });

  it("uses the current time when the timestamp is omitted", async () => {
    const repository = new InMemoryHistoricalPriceRepository({ now: () => day(9) });
    const stored = await repository.create(candle("a1", undefined));
    expect(stored.timestamp).toEqual(day(9));
  });

  it("replays the same candle without duplicating it: the last write wins", async () => {
    const repository = new InMemoryHistoricalPriceRepository();
    await repository.create(candle("a1", day(5), "100"));
    const replayed = await repository.create(candle("a1", day(5), "110"));
    expect(replayed.close).toEqual(Money.of("110", "USD"));
    expect(await repository.listByAssetId("a1", day(1), day(30))).toHaveLength(1);
  });

  it("lists one asset's candles in the inclusive range, oldest first", async () => {
    const repository = new InMemoryHistoricalPriceRepository();
    await repository.create(candle("a1", day(7)));
    await repository.create(candle("a1", day(3)));
    await repository.create(candle("a1", day(5)));
    await repository.create(candle("a1", day(20)));
    await repository.create(candle("a2", day(5)));
    const found = await repository.listByAssetId("a1", day(3), day(7));
    expect(found.map((c) => c.timestamp)).toEqual([day(3), day(5), day(7)]);
  });
});
