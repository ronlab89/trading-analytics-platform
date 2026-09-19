import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { prisma } from "../client.js";
import { PrismaHistoricalPriceRepository } from "./prisma-historical-price-repository.js";

describe("PrismaHistoricalPriceRepository", () => {
  const repository = new PrismaHistoricalPriceRepository();

  let assetId: string;

  beforeAll(async () => {
    const asset = await prisma.asset.create({
      data: {
        symbol: `HP-${crypto.randomUUID().slice(0, 8)}`,
        name: "Test Asset",
        assetType: "CRYPTO",
        currency: "USD",
        exchange: "MOCK",
      },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    await prisma.asset.delete({ where: { id: assetId } });
    await prisma.$disconnect();
  });

  it("creates a candle with all four OHLC fields sharing one currency", async () => {
    const timestamp = new Date("2026-01-01T00:00:00.000Z");

    const candle = await repository.create({
      assetId,
      timestamp,
      open: Money.of("100", "USD"),
      high: Money.of("110", "USD"),
      low: Money.of("95", "USD"),
      close: Money.of("105", "USD"),
      volume: 1500,
    });

    expect(candle.open.equals(Money.of("100", "USD"))).toBe(true);
    expect(candle.high.equals(Money.of("110", "USD"))).toBe(true);
    expect(candle.volume).toBe(1500);
  });

  it("replaying the same candle (same assetId + timestamp) overwrites instead of duplicating", async () => {
    const timestamp = new Date("2026-01-02T00:00:00.000Z");

    await repository.create({
      assetId,
      timestamp,
      open: Money.of("100", "USD"),
      high: Money.of("110", "USD"),
      low: Money.of("95", "USD"),
      close: Money.of("105", "USD"),
      volume: 1000,
    });

    const replayed = await repository.create({
      assetId,
      timestamp,
      open: Money.of("100", "USD"),
      high: Money.of("112", "USD"),
      low: Money.of("94", "USD"),
      close: Money.of("108", "USD"),
      volume: 1800,
    });

    expect(replayed.close.equals(Money.of("108", "USD"))).toBe(true);

    const rows = await prisma.historicalPrice.findMany({ where: { assetId, timestamp } });
    expect(rows).toHaveLength(1);
  });

  it("lists candles within a date range, ordered ascending", async () => {
    const candles = await repository.listByAssetId(
      assetId,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-02T23:59:59.000Z"),
    );

    expect(candles.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < candles.length; i++) {
      const previous = candles[i - 1];
      const current = candles[i];
      if (previous && current) {
        expect(previous.timestamp.getTime()).toBeLessThanOrEqual(current.timestamp.getTime());
      }
    }
  });
});
