import { afterAll } from "vitest";
import { portfolioRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaPortfolioRepository } from "./prisma-portfolio-repository.js";

/**
 * Integration test for `PrismaPortfolioRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `PortfolioRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:migrate`) before running.
 *
 * Each test gets two dedicated users (the foreign key owners). Deleting them at
 * teardown cascades (onDelete: Cascade, see schema.prisma) and removes every
 * portfolio created by the test, so the suite does not depend on execution
 * order or on a previous run having cleaned up after itself.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

portfolioRepositoryContract("PrismaPortfolioRepository", async () => {
  const suffix = crypto.randomUUID();
  const owner = await prisma.user.create({
    data: {
      email: `portfolio-repo-test-${suffix}@example.com`,
      displayName: "Portfolio Repository Test User",
    },
  });
  const other = await prisma.user.create({
    data: {
      email: `portfolio-repo-test-other-${suffix}@example.com`,
      displayName: "Portfolio Repository Other Test User",
    },
  });

  return {
    repository: new PrismaPortfolioRepository(),
    fixtures: { userId: owner.id, otherUserId: other.id },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    },
  };
});
