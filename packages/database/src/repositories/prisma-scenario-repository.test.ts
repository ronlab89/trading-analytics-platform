import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scenarioRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaScenarioRepository } from "./prisma-scenario-repository.js";

/**
 * Integration test for `PrismaScenarioRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `ScenarioRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each contract test gets one dedicated user and two portfolios (the foreign
 * key owners). Deleting the user cascades (onDelete: Cascade, see
 * schema.prisma) to the portfolios and to the scenarios created by the test.
 *
 * The checks below the contract are Prisma-only: they write rows straight into
 * the table, which the repository interface cannot do.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

function createUser(label: string) {
  return prisma.user.create({
    data: {
      email: `scenario-repo-test-${label}-${crypto.randomUUID()}@example.com`,
      displayName: "Scenario Repository Test User",
    },
  });
}

scenarioRepositoryContract("PrismaScenarioRepository", async () => {
  const user = await createUser("contract");
  const portfolio = await prisma.portfolio.create({
    data: { userId: user.id, name: "Scenario Test Portfolio", baseCurrency: "USD" },
  });
  const otherPortfolio = await prisma.portfolio.create({
    data: { userId: user.id, name: "Other Scenario Test Portfolio", baseCurrency: "USD" },
  });

  return {
    repository: new PrismaScenarioRepository(),
    fixtures: { portfolioId: portfolio.id, otherPortfolioId: otherPortfolio.id },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: user.id } });
    },
  };
});

describe("PrismaScenarioRepository (Prisma-only checks)", () => {
  const repository = new PrismaScenarioRepository();

  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    const user = await createUser("prisma-only");
    userId = user.id;

    const portfolio = await prisma.portfolio.create({
      data: { userId, name: "Test Portfolio", baseCurrency: "USD" },
    });
    portfolioId = portfolio.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  it("ignores malformed stored changes instead of failing the read", async () => {
    const row = await prisma.scenario.create({
      data: {
        portfolioId,
        name: "Corrupted Changes",
        changes: [
          { assetId: "asset_001", percentChange: 4 },
          { assetId: "asset_002", percentChange: "not-a-number" },
          { percentChange: 9 },
          5,
          null,
        ],
      },
    });

    const scenario = await repository.getById(row.id);

    expect(scenario?.changes).toEqual([{ assetId: "asset_001", percentChange: 4 }]);
  });

  it("treats a non-array stored changes value as no changes", async () => {
    const row = await prisma.scenario.create({
      data: { portfolioId, name: "Not An Array", changes: { assetId: "asset_001" } },
    });

    const scenario = await repository.getById(row.id);

    expect(scenario?.changes).toEqual([]);
  });

  it("lists scenarios newest first regardless of insertion order", async () => {
    const orderingPortfolio = await prisma.portfolio.create({
      data: { userId, name: "Ordering Portfolio", baseCurrency: "USD" },
    });
    const scenarioData = (name: string, createdAt: string) => ({
      portfolioId: orderingPortfolio.id,
      name,
      createdAt: new Date(createdAt),
    });

    await prisma.scenario.create({ data: scenarioData("Newest", "2026-03-01T00:00:00Z") });
    await prisma.scenario.create({ data: scenarioData("Oldest", "2026-01-01T00:00:00Z") });
    await prisma.scenario.create({ data: scenarioData("Middle", "2026-02-01T00:00:00Z") });

    const scenarios = await repository.listByPortfolioId(orderingPortfolio.id);

    expect(scenarios.map((s) => s.name)).toEqual(["Newest", "Middle", "Oldest"]);
  });
});
