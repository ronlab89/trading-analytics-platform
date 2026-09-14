import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { prisma } from "../client.js";
import { PrismaMarketEventRepository } from "./prisma-market-event-repository.js";

describe("PrismaMarketEventRepository", () => {
  const repository = new PrismaMarketEventRepository();

  let assetId: string;

  beforeAll(async () => {
    const asset = await prisma.asset.create({
      data: {
        symbol: `ME-${crypto.randomUUID().slice(0, 8)}`,
        name: "Test Asset",
        assetType: "CRYPTO",
        currency: "USD",
        exchange: "MOCK",
      },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    await prisma.asset.delete({ where: { id: assetId } });
    await prisma.$disconnect();
  });

  it("returns null sequence when no events exist yet", async () => {
    expect(await repository.getLastSequence(assetId)).toBeNull();
  });

  it("creates an event, converting sequence to/from BigInt transparently", async () => {
    const event = await repository.create({
      assetId,
      price: Money.of("184.22", "USD"),
      sequence: 1,
    });

    expect(event.sequence).toBe(1);
    expect(typeof event.sequence).toBe("number");
  });

  it("tracks the last sequence as events are appended", async () => {
    await repository.create({ assetId, price: Money.of("185", "USD"), sequence: 2 });
    await repository.create({ assetId, price: Money.of("186", "USD"), sequence: 3 });

    expect(await repository.getLastSequence(assetId)).toBe(3);
  });

  it("lists events after a given sequence, in ascending order", async () => {
    const events = await repository.listByAssetId(assetId, 1);

    expect(events.every((e) => e.sequence > 1)).toBe(true);
    for (let i = 1; i < events.length; i++) {
      const previous = events[i - 1];
      const current = events[i];
      if (previous && current) {
        expect(previous.sequence).toBeLessThan(current.sequence);
      }
    }
  });

  it("lists all events when afterSequence is omitted", async () => {
    const events = await repository.listByAssetId(assetId);
    expect(events.length).toBeGreaterThanOrEqual(3);
  });
});
