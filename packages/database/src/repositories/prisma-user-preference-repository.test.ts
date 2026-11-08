import { afterAll } from "vitest";
import { userPreferenceRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaUserPreferenceRepository } from "./prisma-user-preference-repository.js";

/**
 * Integration test for `PrismaUserPreferenceRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `UserPreferenceRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets two dedicated users (the foreign key owners). Deleting them at
 * teardown cascades (onDelete: Cascade, see schema.prisma) and removes the
 * preferences created by the test.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

userPreferenceRepositoryContract("PrismaUserPreferenceRepository", async () => {
  const suffix = crypto.randomUUID();
  const owner = await prisma.user.create({
    data: {
      email: `preference-repo-test-${suffix}@example.com`,
      displayName: "Preference Repository Test User",
    },
  });
  const other = await prisma.user.create({
    data: {
      email: `preference-repo-test-other-${suffix}@example.com`,
      displayName: "Preference Repository Other Test User",
    },
  });

  return {
    repository: new PrismaUserPreferenceRepository(),
    fixtures: { userId: owner.id, otherUserId: other.id },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    },
  };
});
