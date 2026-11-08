import { afterAll } from "vitest";
import { positionRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaPositionRepository } from "./prisma-position-repository.js";

/**
 * Integration test for `PrismaPositionRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `PositionRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets one dedicated user, two portfolios and two assets (the
 * foreign key owners). Deleting the user cascades (onDelete: Cascade, see
 * schema.prisma) to the portfolios and to the positions created by the test.
 * The assets are deleted afterwards: a position restricts the deletion of its
 * asset (onDelete: Restrict), so they can only go once the positions are gone.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

function createAsset(label: string) {
  return prisma.asset.create({
    data: {
      symbol: `POS-${label}-${crypto.randomUUID().slice(0, 8)}`,
      name: "Position Test Asset",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
    },
  });
}

positionRepositoryContract("PrismaPositionRepository", async () => {
  const user = await prisma.user.create({
    data: {
      email: `position-repo-test-${crypto.randomUUID()}@example.com`,
      displayName: "Position Repository Test User",
    },
  });
  const portfolio = await prisma.portfolio.create({
    data: { userId: user.id, name: "Position Test Portfolio", baseCurrency: "USD" },
  });
  const otherPortfolio = await prisma.portfolio.create({
    data: { userId: user.id, name: "Other Position Test Portfolio", baseCurrency: "USD" },
  });
  const asset = await createAsset("A");
  const otherAsset = await createAsset("B");

  return {
    repository: new PrismaPositionRepository(),
    fixtures: {
      portfolioId: portfolio.id,
      otherPortfolioId: otherPortfolio.id,
      assetId: asset.id,
      otherAssetId: otherAsset.id,
    },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: user.id } });
      await prisma.asset.deleteMany({ where: { id: { in: [asset.id, otherAsset.id] } } });
    },
  };
});
