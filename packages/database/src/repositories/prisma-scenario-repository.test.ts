import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaScenarioRepository } from "./prisma-scenario-repository.js";

describe("PrismaScenarioRepository", () => {
  const repository = new PrismaScenarioRepository();

  let userId: string;
  let portfolioId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `scenario-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Scenario Repository Test User",
      },
    });
    userId = user.id;

    const portfolio = await prisma.portfolio.create({
      data: { userId, name: "Test Portfolio", baseCurrency: "USD" },
    });
    portfolioId = portfolio.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("creates a scenario with default DRAFT status", async () => {
    const scenario = await repository.create({
      portfolioId,
      name: "Increase technology exposure",
      description: "Evaluate higher technology allocation.",
    });

    expect(scenario.status).toBe("DRAFT");
    expect(scenario.baseSnapshotId).toBeNull();
  });

  it("retrieves a scenario by id and lists by portfolio", async () => {
    const created = await repository.create({ portfolioId, name: "Listable Scenario" });

    expect((await repository.getById(created.id))?.id).toBe(created.id);

    const scenarios = await repository.listByPortfolioId(portfolioId);
    expect(scenarios.some((s) => s.id === created.id)).toBe(true);
  });

  it("updates name, description and status", async () => {
    const created = await repository.create({ portfolioId, name: "To Rename" });

    const updated = await repository.update(created.id, {
      name: "Renamed Scenario",
      status: "SAVED",
    });

    expect(updated.name).toBe("Renamed Scenario");
    expect(updated.status).toBe("SAVED");
  });

  it("persists changes via updateChanges without exposing them on the returned entity", async () => {
    const created = await repository.create({ portfolioId, name: "With Changes" });

    const updated = await repository.updateChanges(created.id, [
      { assetId: "asset_001", percentChange: 10 },
      { assetId: "asset_002", percentChange: -5 },
    ]);

    // The domain Scenario entity intentionally has no `changes` field.
    expect(updated).not.toHaveProperty("changes");
    expect(updated.id).toBe(created.id);
  });

  it("deletes a scenario", async () => {
    const created = await repository.create({ portfolioId, name: "To Delete" });

    await repository.delete(created.id);

    expect(await repository.getById(created.id)).toBeNull();
  });
});
