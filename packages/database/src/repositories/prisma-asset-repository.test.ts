import { afterAll } from "vitest";
import {
  ASSET_CONTRACT_SYMBOL_PREFIX,
  assetRepositoryContract,
} from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaAssetRepository } from "./prisma-asset-repository.js";

/**
 * Integration test for `PrismaAssetRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `AssetRepository` contract suite (the same one the in-memory
 * implementation passes) against the real Docker Postgres instance (see
 * docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:migrate`) before running.
 *
 * Assets have no owner, so there is nothing to cascade from. Every symbol the
 * suite creates starts with `ASSET_CONTRACT_SYMBOL_PREFIX`; teardown deletes by
 * that prefix, which also clears leftovers from a run that failed midway.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

assetRepositoryContract("PrismaAssetRepository", () =>
  Promise.resolve({
    repository: new PrismaAssetRepository(),
    cleanup: async () => {
      await prisma.asset.deleteMany({
        where: { symbol: { startsWith: ASSET_CONTRACT_SYMBOL_PREFIX } },
      });
    },
  }),
);
