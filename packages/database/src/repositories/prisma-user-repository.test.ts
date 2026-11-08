import { afterAll } from "vitest";
import {
  USER_CONTRACT_EMAIL_PREFIX,
  userRepositoryContract,
} from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaUserRepository } from "./prisma-user-repository.js";

/**
 * Integration test for `PrismaUserRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `UserRepository` contract suite (the same one the in-memory
 * implementation passes) against the real Docker Postgres instance (see
 * docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Every email the suite creates starts with `USER_CONTRACT_EMAIL_PREFIX`;
 * teardown deletes by that prefix, which also clears leftovers from a run that
 * failed midway. Users are the root of the schema, so deleting them cascades to
 * anything they own.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

userRepositoryContract("PrismaUserRepository", () =>
  Promise.resolve({
    repository: new PrismaUserRepository(),
    cleanup: async () => {
      await prisma.user.deleteMany({
        where: { email: { startsWith: USER_CONTRACT_EMAIL_PREFIX } },
      });
    },
  }),
);
