import { afterAll } from "vitest";
import { idempotencyKeyRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaIdempotencyKeyRepository } from "./prisma-idempotency-key-repository.js";

/**
 * Integration test for `PrismaIdempotencyKeyRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `IdempotencyKeyRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets two dedicated users. Deleting them at teardown cascades and
 * removes the keys created by the test.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

idempotencyKeyRepositoryContract("PrismaIdempotencyKeyRepository", async () => {
  const create = (label: string) =>
    prisma.user.create({
      data: {
        email: `idempotency-repo-test-${label}-${crypto.randomUUID()}@example.com`,
        displayName: "Idempotency Repository Test User",
      },
    });
  const owner = await create("a");
  const other = await create("b");

  return {
    repository: new PrismaIdempotencyKeyRepository(),
    fixtures: { userId: owner.id, otherUserId: other.id },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    },
  };
});
