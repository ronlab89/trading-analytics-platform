import { afterAll } from "vitest";
import { alertRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaAlertRepository } from "./prisma-alert-repository.js";

/**
 * Integration test for `PrismaAlertRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `AlertRepository` contract suite (the same one the in-memory
 * implementation passes) against the real Docker Postgres instance (see
 * docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets two dedicated users, one asset and one portfolio (the foreign
 * key owners). Deleting the users cascades (onDelete: Cascade, see
 * schema.prisma) to the portfolio and to the alerts created by the test; the
 * asset is deleted on its own.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

function createUser(label: string) {
  return prisma.user.create({
    data: {
      email: `alert-repo-test-${label}-${crypto.randomUUID()}@example.com`,
      displayName: "Alert Repository Test User",
    },
  });
}

alertRepositoryContract("PrismaAlertRepository", async () => {
  const user = await createUser("a");
  const otherUser = await createUser("b");
  const asset = await prisma.asset.create({
    data: {
      symbol: `ALRT-${crypto.randomUUID().slice(0, 8)}`,
      name: "Alert Test Asset",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
    },
  });
  const portfolio = await prisma.portfolio.create({
    data: { userId: user.id, name: "Alert Test Portfolio", baseCurrency: "USD" },
  });

  return {
    repository: new PrismaAlertRepository(),
    fixtures: {
      userId: user.id,
      otherUserId: otherUser.id,
      assetId: asset.id,
      portfolioId: portfolio.id,
    },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } });
      await prisma.asset.deleteMany({ where: { id: asset.id } });
    },
  };
});
