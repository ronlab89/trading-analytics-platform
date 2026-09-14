import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { prisma } from "../client.js";
import { PrismaMarketPriceRepository } from "./prisma-market-price-repository.js";

describe("PrismaMarketPriceRepository", () => {
  const repository = new PrismaMarketPriceRepository();

  let assetId: string;
  let otherAssetId: string;

  beforeAll(async () => {
    const asset = await prisma.asset.create({
      data: {
        symbol: `MP-${crypto.randomUUID().slice(0, 8)}`,
        name: "Test Asset",
        assetType: "CRYPTO",
        currency: "USD",
        exchange: "MOCK",
      },
    });
    assetId = asset.id;

    const otherAsset = await prisma.asset.create({
      data: {
        symbol: `MP2-${crypto.randomUUID().slice(0, 8)}`,
        name: "Other Test Asset",
        assetType: "CRYPTO",
        currency: "USD",
        exchange: "MOCK",
      },
    });
    otherAssetId = otherAsset.id;
  });

  afterAll(async () => {
    await prisma.asset.delete({ where: { id: assetId } });
    await prisma.asset.delete({ where: { id: otherAssetId } });
    await prisma.$disconnect();
  });

  it("returns null when no price exists yet", async () => {
    expect(await repository.getByAssetId(assetId)).toBeNull();
  });

  it("creates a price on first upsert", async () => {
    const price = await repository.upsert({
      assetId,
      price: Money.of("184.22", "USD"),
      previousPrice: Money.of("181.40", "USD"),
      change: Money.of("2.82", "USD"),
      changePercent: 1.55,
      timestamp: new Date(),
      source: "MOCK",
    });

    expect(price.price.equals(Money.of("184.22", "USD"))).toBe(true);
    expect(price.source).toBe("MOCK");
  });

  it("overwrites the current price on a second upsert", async () => {
    await repository.upsert({
      assetId,
      price: Money.of("184.22", "USD"),
      previousPrice: Money.of("181.40", "USD"),
      change: Money.of("2.82", "USD"),
      changePercent: 1.55,
      timestamp: new Date(),
      source: "MOCK",
    });

    const updated = await repository.upsert({
      assetId,
      price: Money.of("190.00", "USD"),
      previousPrice: Money.of("184.22", "USD"),
      change: Money.of("5.78", "USD"),
      changePercent: 3.14,
      timestamp: new Date(),
      source: "MOCK",
    });

    expect(updated.price.equals(Money.of("190.00", "USD"))).toBe(true);

    const listed = await prisma.marketPrice.findMany({ where: { assetId } });
    expect(listed).toHaveLength(1);
  });

  it("lists prices for multiple assets in one call", async () => {
    await repository.upsert({
      assetId,
      price: Money.of("100", "USD"),
      previousPrice: Money.of("99", "USD"),
      change: Money.of("1", "USD"),
      changePercent: 1.01,
      timestamp: new Date(),
      source: "MOCK",
    });
    await repository.upsert({
      assetId: otherAssetId,
      price: Money.of("50", "USD"),
      previousPrice: Money.of("49", "USD"),
      change: Money.of("1", "USD"),
      changePercent: 2.04,
      timestamp: new Date(),
      source: "MOCK",
    });

    const prices = await repository.listByAssetIds([assetId, otherAssetId]);
    expect(prices).toHaveLength(2);
  });
});
