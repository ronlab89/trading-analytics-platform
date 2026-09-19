import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvalidWatchlistItemError } from "@trading/domain";
import { prisma } from "../client.js";
import { PrismaWatchlistItemRepository } from "./prisma-watchlist-item-repository.js";

describe("PrismaWatchlistItemRepository", () => {
  const repository = new PrismaWatchlistItemRepository();

  let userId: string;
  let assetId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `watchlist-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Watchlist Repository Test User",
      },
    });
    userId = user.id;

    const asset = await prisma.asset.create({
      data: {
        symbol: `WATCH-${crypto.randomUUID().slice(0, 8)}`,
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

  it("creates a watchlist item", async () => {
    const item = await repository.create({ userId, assetId });
    expect(item.userId).toBe(userId);
    expect(item.assetId).toBe(assetId);

    await repository.deleteByUserAndAsset(userId, assetId);
  });

  it("rejects a duplicate entry with a domain error", async () => {
    await repository.create({ userId, assetId });

    await expect(repository.create({ userId, assetId })).rejects.toThrow(InvalidWatchlistItemError);

    await repository.deleteByUserAndAsset(userId, assetId);
  });

  it("lists watchlist items for a user", async () => {
    await repository.create({ userId, assetId });

    const items = await repository.listByUserId(userId);
    expect(items.some((i) => i.assetId === assetId)).toBe(true);
  });

  it("deletes a watchlist item by user and asset", async () => {
    await repository.deleteByUserAndAsset(userId, assetId);
    const items = await repository.listByUserId(userId);
    expect(items.some((i) => i.assetId === assetId)).toBe(false);
  });
});
