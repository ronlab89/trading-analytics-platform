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

  it("creates a scenario with no changes by default", async () => {
    const scenario = await repository.create({ portfolioId, name: "No Changes Yet" });

    expect(scenario.changes).toEqual([]);
  });

  it("creates a scenario with its changes", async () => {
    const scenario = await repository.create({
      portfolioId,
      name: "Created With Changes",
      changes: [
        { assetId: "asset_001", percentChange: 15 },
        { assetId: "asset_002", percentChange: -10 },
      ],
    });

    expect(scenario.changes).toEqual([
      { assetId: "asset_001", percentChange: 15 },
      { assetId: "asset_002", percentChange: -10 },
    ]);
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

  it("keeps the changes when name, description or status are updated", async () => {
    const created = await repository.create({
      portfolioId,
      name: "Keeps Changes",
      changes: [{ assetId: "asset_001", percentChange: 7 }],
    });

    const updated = await repository.update(created.id, { name: "Still Has Changes" });

    expect(updated.changes).toEqual([{ assetId: "asset_001", percentChange: 7 }]);
  });

  it("persists changes via updateChanges and reads them back", async () => {
    const created = await repository.create({ portfolioId, name: "With Changes" });

    const updated = await repository.updateChanges(created.id, [
      { assetId: "asset_001", percentChange: 10 },
      { assetId: "asset_002", percentChange: -5 },
    ]);

    const expected = [
      { assetId: "asset_001", percentChange: 10 },
      { assetId: "asset_002", percentChange: -5 },
    ];

    expect(updated.id).toBe(created.id);
    expect(updated.changes).toEqual(expected);
    expect((await repository.getById(created.id))?.changes).toEqual(expected);

    const listed = (await repository.listByPortfolioId(portfolioId)).find(
      (s) => s.id === created.id,
    );
    expect(listed?.changes).toEqual(expected);
  });

  it("replaces the previous changes, and an empty array resets them", async () => {
    const created = await repository.create({
      portfolioId,
      name: "To Reset",
      changes: [{ assetId: "asset_001", percentChange: 10 }],
    });

    const replaced = await repository.updateChanges(created.id, [
      { assetId: "asset_009", percentChange: -3 },
    ]);
    expect(replaced.changes).toEqual([{ assetId: "asset_009", percentChange: -3 }]);

    const reset = await repository.updateChanges(created.id, []);
    expect(reset.changes).toEqual([]);
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

  it("deletes a scenario", async () => {
    const created = await repository.create({ portfolioId, name: "To Delete" });

    await repository.delete(created.id);

    expect(await repository.getById(created.id)).toBeNull();
  });
});
