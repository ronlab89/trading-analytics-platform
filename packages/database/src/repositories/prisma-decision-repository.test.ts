import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { prisma } from "../client.js";
import { PrismaDecisionRepository } from "./prisma-decision-repository.js";

describe("PrismaDecisionRepository", () => {
  const repository = new PrismaDecisionRepository();

  let userId: string;
  let portfolioId: string;
  let assetId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `decision-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Decision Repository Test User",
      },
    });
    userId = user.id;

    const portfolio = await prisma.portfolio.create({
      data: { userId, name: "Test Portfolio", baseCurrency: "USD" },
    });
    portfolioId = portfolio.id;

    const asset = await prisma.asset.create({
      data: {
        symbol: `DEC-${crypto.randomUUID().slice(0, 8)}`,
        name: "Test Asset",
        assetType: "CRYPTO",
        currency: "USD",
        exchange: "MOCK",
      },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.asset.delete({ where: { id: assetId } });
    await prisma.$disconnect();
  });

  it("creates a decision with no prices at all", async () => {
    const decision = await repository.create({
      portfolioId,
      assetId,
      title: "Watching for breakout",
      thesis: "Price is consolidating near resistance.",
      direction: "LONG",
    });

    expect(decision.entryPrice).toBeNull();
    expect(decision.targetPrice).toBeNull();
    expect(decision.stopPrice).toBeNull();
    expect(decision.closedAt).toBeNull();
    expect(decision.outcome).toBeNull();
  });

  it("creates a decision with entry, target and stop sharing one currency", async () => {
    const decision = await repository.create({
      portfolioId,
      assetId,
      title: "Breakout entry",
      thesis: "Confirmed breakout above resistance.",
      direction: "LONG",
      entryPrice: Money.of("180", "USD"),
      targetPrice: Money.of("195", "USD"),
      stopPrice: Money.of("174", "USD"),
    });

    expect(decision.entryPrice?.equals(Money.of("180", "USD"))).toBe(true);
    expect(decision.targetPrice?.equals(Money.of("195", "USD"))).toBe(true);
    expect(decision.stopPrice?.equals(Money.of("174", "USD"))).toBe(true);
  });

  it("retrieves a decision by id and lists by portfolio with filters", async () => {
    const created = await repository.create({
      portfolioId,
      assetId,
      title: "Short setup",
      thesis: "Bearish divergence on the daily chart.",
      direction: "SHORT",
    });

    expect((await repository.getById(created.id))?.id).toBe(created.id);

    const shorts = await repository.listByPortfolioId(portfolioId, { direction: "SHORT" });
    expect(shorts.some((d) => d.id === created.id)).toBe(true);
    expect(shorts.every((d) => d.direction === "SHORT")).toBe(true);
  });

  it("updates targetPrice and stopPrice, keeping the shared currency consistent", async () => {
    const created = await repository.create({
      portfolioId,
      assetId,
      title: "To adjust",
      thesis: "Initial thesis.",
      direction: "LONG",
      entryPrice: Money.of("100", "USD"),
    });

    const updated = await repository.update(created.id, {
      targetPrice: Money.of("120", "USD"),
      notes: "Adjusted target after strong volume.",
    });

    expect(updated.targetPrice?.equals(Money.of("120", "USD"))).toBe(true);
    expect(updated.notes).toBe("Adjusted target after strong volume.");
  });

  it("closes a decision, recording its outcome and closedAt", async () => {
    const created = await repository.create({
      portfolioId,
      assetId,
      title: "To close",
      thesis: "Thesis played out.",
      direction: "LONG",
    });

    const closedAt = new Date("2026-03-01T00:00:00.000Z");
    const closed = await repository.close(
      created.id,
      "Target reached, closed for profit.",
      closedAt,
    );

    expect(closed.outcome).toBe("Target reached, closed for profit.");
    expect(closed.closedAt?.toISOString()).toBe(closedAt.toISOString());
  });
});
