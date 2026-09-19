import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaAlertRepository } from "./prisma-alert-repository.js";

describe("PrismaAlertRepository", () => {
  const repository = new PrismaAlertRepository();

  let userId: string;
  let assetId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `alert-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Alert Repository Test User",
      },
    });
    userId = user.id;

    const asset = await prisma.asset.create({
      data: {
        symbol: `ALRT-${crypto.randomUUID().slice(0, 8)}`,
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

  it("creates an alert with default enabled=true", async () => {
    const alert = await repository.create({
      userId,
      assetId,
      type: "PRICE",
      condition: "ABOVE",
      threshold: 200,
    });

    expect(alert.enabled).toBe(true);
    expect(alert.portfolioId).toBeNull();
  });

  it("retrieves an alert by id and lists by user", async () => {
    const created = await repository.create({
      userId,
      assetId,
      type: "PRICE",
      condition: "BELOW",
      threshold: 100,
    });

    expect((await repository.getById(created.id))?.id).toBe(created.id);

    const alerts = await repository.listByUserId(userId);
    expect(alerts.some((a) => a.id === created.id)).toBe(true);
  });

  it("updates condition, threshold and enabled", async () => {
    const created = await repository.create({
      userId,
      assetId,
      type: "PRICE",
      condition: "ABOVE",
      threshold: 150,
    });

    const updated = await repository.update(created.id, { threshold: 175, enabled: false });

    expect(updated.threshold).toBe(175);
    expect(updated.enabled).toBe(false);
  });

  it("deletes an alert", async () => {
    const created = await repository.create({
      userId,
      assetId,
      type: "PRICE",
      condition: "ABOVE",
      threshold: 500,
    });

    await repository.delete(created.id);
    expect(await repository.getById(created.id)).toBeNull();
  });
});
