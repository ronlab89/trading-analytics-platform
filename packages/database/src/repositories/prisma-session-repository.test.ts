import { afterAll } from "vitest";
import { sessionRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaSessionRepository } from "./prisma-session-repository.js";

/**
 * Integration test for `PrismaSessionRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `SessionRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets a dedicated user (the foreign key owner). Deleting it at
 * teardown cascades (onDelete: Cascade, see schema.prisma) and removes the
 * sessions created by the test.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

sessionRepositoryContract("PrismaSessionRepository", async () => {
  const owner = await prisma.user.create({
    data: {
      email: `session-repo-test-${crypto.randomUUID()}@example.com`,
      displayName: "Session Repository Test User",
    },
  });

  return {
    repository: new PrismaSessionRepository(),
    fixtures: { userId: owner.id },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: owner.id } });
    },
  };
});
