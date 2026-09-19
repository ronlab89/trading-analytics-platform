import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaDecisionEventRepository } from "./prisma-decision-event-repository.js";

describe("PrismaDecisionEventRepository", () => {
  const repository = new PrismaDecisionEventRepository();

  let userId: string;
  let portfolioId: string;
  let assetId: string;
  let decisionId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `decision-event-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Decision Event Repository Test User",
      },
    });
    userId = user.id;

    const portfolio = await prisma.portfolio.create({
      data: { userId, name: "Test Portfolio", baseCurrency: "USD" },
    });
    portfolioId = portfolio.id;

    const asset = await prisma.asset.create({
      data: {
        symbol: `EVT-${crypto.randomUUID().slice(0, 8)}`,
        name: "Test Asset",
        assetType: "CRYPTO",
        currency: "USD",
        exchange: "MOCK",
      },
    });
    assetId = asset.id;

    const decision = await prisma.decision.create({
      data: {
        portfolioId,
        assetId,
        title: "Test Decision",
        thesis: "Testing decision events.",
        direction: "LONG",
      },
    });
    decisionId = decision.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.asset.delete({ where: { id: assetId } });
    await prisma.$disconnect();
  });

  it("creates an event with an explicit payload", async () => {
    const event = await repository.create({
      decisionId,
      type: "DECISION_CREATED",
      payload: { source: "manual" },
    });

    expect(event.payload).toEqual({ source: "manual" });
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it("defaults payload to {} when omitted", async () => {
    const event = await repository.create({ decisionId, type: "THESIS_RECORDED" });
    expect(event.payload).toEqual({});
  });

  it("lists events for a decision in chronological order", async () => {
    await repository.create({ decisionId, type: "POSITION_OPENED", payload: { step: 1 } });
    await repository.create({ decisionId, type: "PRICE_UPDATE", payload: { step: 2 } });

    const events = await repository.listByDecisionId(decisionId);

    expect(events.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < events.length; i++) {
      const previous = events[i - 1];
      const current = events[i];
      if (previous && current) {
        expect(previous.timestamp.getTime()).toBeLessThanOrEqual(current.timestamp.getTime());
      }
    }
  });
});
