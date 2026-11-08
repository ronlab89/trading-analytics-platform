import { afterAll } from "vitest";
import { marketEventRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaMarketEventRepository } from "./prisma-market-event-repository.js";

/**
 * Integration test for `PrismaMarketEventRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `MarketEventRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets two dedicated assets (the foreign key owners). Deleting them
 * at teardown cascades (onDelete: Cascade, see schema.prisma) and removes the
 * events created by the test.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

function createAsset(label: string) {
  return prisma.asset.create({
    data: {
      symbol: `ME-${label}-${crypto.randomUUID().slice(0, 8)}`,
      name: "Market Event Test Asset",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
    },
  });
}

marketEventRepositoryContract("PrismaMarketEventRepository", async () => {
  const asset = await createAsset("A");
  const other = await createAsset("B");

  return {
    repository: new PrismaMarketEventRepository(),
    fixtures: { assetId: asset.id, otherAssetId: other.id },
    cleanup: async () => {
      await prisma.asset.deleteMany({ where: { id: { in: [asset.id, other.id] } } });
    },
  };
});
