import { afterAll } from "vitest";
import { watchlistItemRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaWatchlistItemRepository } from "./prisma-watchlist-item-repository.js";

/**
 * Integration test for `PrismaWatchlistItemRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `WatchlistItemRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets two dedicated users and two dedicated assets (the foreign key
 * owners). Deleting them at teardown cascades (onDelete: Cascade, see
 * schema.prisma) and removes the items created by the test.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

function createUser(label: string) {
  return prisma.user.create({
    data: {
      email: `watchlist-repo-test-${label}-${crypto.randomUUID()}@example.com`,
      displayName: "Watchlist Repository Test User",
    },
  });
}

function createAsset(label: string) {
  return prisma.asset.create({
    data: {
      symbol: `WATCH-${label}-${crypto.randomUUID().slice(0, 8)}`,
      name: "Watchlist Test Asset",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
    },
  });
}

watchlistItemRepositoryContract("PrismaWatchlistItemRepository", async () => {
  const user = await createUser("a");
  const otherUser = await createUser("b");
  const asset = await createAsset("A");
  const otherAsset = await createAsset("B");

  return {
    repository: new PrismaWatchlistItemRepository(),
    fixtures: {
      userId: user.id,
      otherUserId: otherUser.id,
      assetId: asset.id,
      otherAssetId: otherAsset.id,
    },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } });
      await prisma.asset.deleteMany({ where: { id: { in: [asset.id, otherAsset.id] } } });
    },
  };
});
