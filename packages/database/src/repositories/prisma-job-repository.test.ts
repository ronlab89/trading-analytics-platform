import { afterAll } from "vitest";
import { jobRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaJobRepository } from "./prisma-job-repository.js";

/**
 * Integration test for `PrismaJobRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `JobRepository` contract suite (the same one the in-memory
 * implementation passes) against the real Docker Postgres instance (see
 * docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets a dedicated user and portfolio (the foreign key owners).
 * Deleting the user at teardown cascades and removes the portfolio and the
 * jobs created by the test.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

jobRepositoryContract("PrismaJobRepository", async () => {
  const owner = await prisma.user.create({
    data: {
      email: `job-repo-test-${crypto.randomUUID()}@example.com`,
      displayName: "Job Repository Test User",
    },
  });
  const portfolio = await prisma.portfolio.create({
    data: { userId: owner.id, name: "Job Repository Portfolio", baseCurrency: "USD" },
  });

  return {
    repository: new PrismaJobRepository(),
    fixtures: { userId: owner.id, portfolioId: portfolio.id },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: owner.id } });
    },
  };
});
