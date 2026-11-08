import { afterAll } from "vitest";
import { decisionEventRepositoryContract } from "@trading/persistence-memory/contract";
import { prisma } from "../client.js";
import { PrismaDecisionEventRepository } from "./prisma-decision-event-repository.js";

/**
 * Integration test for `PrismaDecisionEventRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Runs the shared `DecisionEventRepository` contract suite (the same one the
 * in-memory implementation passes) against the real Docker Postgres instance
 * (see docker-compose.yml). It is NOT a unit test: the database must be up
 * (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:test:migrate`) before running.
 *
 * Each test gets one dedicated user, one portfolio, one asset and two
 * decisions (the foreign key owners). Deleting the user cascades
 * (onDelete: Cascade, see schema.prisma) to the portfolio, the decisions and
 * their events. The asset is deleted afterwards: a decision restricts the
 * deletion of its asset (onDelete: Restrict), so it can only go once the
 * decisions are gone.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

decisionEventRepositoryContract("PrismaDecisionEventRepository", async () => {
  const user = await prisma.user.create({
    data: {
      email: `decision-event-repo-test-${crypto.randomUUID()}@example.com`,
      displayName: "Decision Event Repository Test User",
    },
  });
  const portfolio = await prisma.portfolio.create({
    data: { userId: user.id, name: "Decision Event Test Portfolio", baseCurrency: "USD" },
  });
  const asset = await prisma.asset.create({
    data: {
      symbol: `EVT-${crypto.randomUUID().slice(0, 8)}`,
      name: "Decision Event Test Asset",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
    },
  });
  const decisionData = (title: string) => ({
    portfolioId: portfolio.id,
    assetId: asset.id,
    title,
    thesis: "Testing decision events.",
    direction: "LONG" as const,
  });
  const decision = await prisma.decision.create({ data: decisionData("Test Decision") });
  const otherDecision = await prisma.decision.create({ data: decisionData("Other Test Decision") });

  return {
    repository: new PrismaDecisionEventRepository(),
    fixtures: { decisionId: decision.id, otherDecisionId: otherDecision.id },
    cleanup: async () => {
      await prisma.user.deleteMany({ where: { id: user.id } });
      await prisma.asset.deleteMany({ where: { id: asset.id } });
    },
  };
});
