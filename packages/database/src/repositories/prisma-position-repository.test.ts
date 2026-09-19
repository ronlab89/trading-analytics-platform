import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { prisma } from "../client.js";
import { PrismaPositionRepository } from "./prisma-position-repository.js";

/**
 * Integration test for `PrismaPositionRepository`.
 * See prisma-portfolio-repository.test.ts for the shared preconditions.
 */
describe("PrismaPositionRepository", () => {
  const repository = new PrismaPositionRepository();

  let userId: string;
  let portfolioId: string;
  let assetId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `position-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Position Repository Test User",
      },
    });
    userId = user.id;

    const portfolio = await prisma.portfolio.create({
      data: { userId, name: "Test Portfolio", baseCurrency: "USD" },
    });
    portfolioId = portfolio.id;

    const asset = await prisma.asset.create({
      data: {
        symbol: `POS-${crypto.randomUUID().slice(0, 8)}`,
        name: "Test Asset",
        assetType: "CRYPTO",
        currency: "USD",
        exchange: "MOCK",
      },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.asset.delete({ where: { id: assetId } });
    await prisma.$disconnect();
  });

  it("creates a position on first upsert", async () => {
    const position = await repository.upsert({
      portfolioId,
      assetId,
      quantity: 2,
      averageEntryPrice: Money.of("100", "USD"),
      currentPrice: Money.of("110", "USD"),
    });

    expect(position.quantity).toBe(2);
    expect(position.averageEntryPrice.equals(Money.of("100", "USD"))).toBe(true);
    expect(position.openedAt).toBeInstanceOf(Date);
  });

  it("updates quantity/prices on a second upsert WITHOUT resetting openedAt", async () => {
    const first = await repository.upsert({
      portfolioId,
      assetId,
      quantity: 2,
      averageEntryPrice: Money.of("100", "USD"),
      currentPrice: Money.of("110", "USD"),
    });
    const originalOpenedAt = first.openedAt.getTime();

    const second = await repository.upsert({
      portfolioId,
      assetId,
      quantity: 5,
      averageEntryPrice: Money.of("104", "USD"),
      currentPrice: Money.of("120", "USD"),
    });

    expect(second.quantity).toBe(5);
    expect(second.averageEntryPrice.equals(Money.of("104", "USD"))).toBe(true);
    expect(second.openedAt.getTime()).toBe(originalOpenedAt);
  });

  it("retrieves a position by portfolio and asset", async () => {
    const found = await repository.getByPortfolioAndAsset(portfolioId, assetId);
    expect(found?.portfolioId).toBe(portfolioId);
    expect(found?.assetId).toBe(assetId);
  });

  it("returns null for a portfolio/asset pair with no position", async () => {
    const found = await repository.getByPortfolioAndAsset(portfolioId, "nonexistent-asset-id");
    expect(found).toBeNull();
  });

  it("updates only the current price via updateCurrentPrice", async () => {
    const existing = await repository.getByPortfolioAndAsset(portfolioId, assetId);
    if (!existing) throw new Error("Expected a position to exist from previous tests");

    const updated = await repository.updateCurrentPrice(existing.id, Money.of("999.99", "USD"));

    expect(updated.currentPrice.equals(Money.of("999.99", "USD"))).toBe(true);
    // averageEntryPrice must remain untouched by a price-only update
    expect(updated.averageEntryPrice.equals(existing.averageEntryPrice)).toBe(true);
  });

  it("deletes a position by portfolio and asset", async () => {
    await repository.deleteByPortfolioAndAsset(portfolioId, assetId);
    const found = await repository.getByPortfolioAndAsset(portfolioId, assetId);
    expect(found).toBeNull();
  });
});
