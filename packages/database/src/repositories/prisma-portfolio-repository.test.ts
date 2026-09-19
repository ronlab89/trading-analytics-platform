import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaPortfolioRepository } from "./prisma-portfolio-repository.js";

/**
 * Integration test for `PrismaPortfolioRepository`.
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * This test runs against the real Docker Postgres instance (see
 * docker-compose.yml) — it is NOT a unit test and requires the
 * database to be up (`docker compose up -d postgres`) and migrated
 * (`pnpm --filter @trading/database db:migrate`) before running.
 *
 * It exists to validate the repository + mapper pattern end-to-end
 * before replicating it across the remaining 14 repositories
 * (see PROGRESS.md, Phase 2 Step 5).
 */
describe("PrismaPortfolioRepository", () => {
  const repository = new PrismaPortfolioRepository();

  // A dedicated test user owns every portfolio created in this suite.
  // Deleting it at teardown cascades (onDelete: Cascade, see
  // schema.prisma) and cleans up any portfolio left behind by a failed
  // assertion, so this suite does not depend on execution order or on
  // a previous run having cleaned up after itself.
  let testUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `portfolio-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Portfolio Repository Test User",
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it("creates a portfolio and returns it with domain-shaped fields", async () => {
    const portfolio = await repository.create({
      userId: testUserId,
      name: "Growth Portfolio",
      baseCurrency: "USD",
    });

    expect(portfolio.id).toBeTruthy();
    expect(portfolio.userId).toBe(testUserId);
    expect(portfolio.name).toBe("Growth Portfolio");
    expect(portfolio.baseCurrency).toBe("USD");
    expect(portfolio.status).toBe("ACTIVE");
    expect(portfolio.description).toBeNull();
    expect(portfolio.createdAt).toBeInstanceOf(Date);
  });

  it("retrieves a portfolio by id", async () => {
    const created = await repository.create({
      userId: testUserId,
      name: "Long-term",
      baseCurrency: "USD",
    });

    const found = await repository.getById(created.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it("returns null when a portfolio does not exist", async () => {
    const found = await repository.getById("nonexistent-id");
    expect(found).toBeNull();
  });

  it("lists all portfolios belonging to a user", async () => {
    await repository.create({ userId: testUserId, name: "Crypto", baseCurrency: "USD" });
    await repository.create({ userId: testUserId, name: "Experimental", baseCurrency: "USD" });

    const portfolios = await repository.listByUserId(testUserId);

    expect(portfolios.length).toBeGreaterThanOrEqual(2);
    expect(portfolios.every((p) => p.userId === testUserId)).toBe(true);
  });

  it("updates mutable fields, including status transitions", async () => {
    const created = await repository.create({
      userId: testUserId,
      name: "To Archive",
      baseCurrency: "USD",
    });

    const updated = await repository.update(created.id, {
      name: "Renamed Portfolio",
      status: "ARCHIVED",
    });

    expect(updated.name).toBe("Renamed Portfolio");
    expect(updated.status).toBe("ARCHIVED");
  });

  it("deletes a portfolio", async () => {
    const created = await repository.create({
      userId: testUserId,
      name: "To Delete",
      baseCurrency: "USD",
    });

    await repository.delete(created.id);

    const found = await repository.getById(created.id);
    expect(found).toBeNull();
  });
});
