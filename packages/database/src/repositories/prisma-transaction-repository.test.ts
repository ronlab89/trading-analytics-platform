import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { prisma } from "../client.js";
import { PrismaTransactionRepository } from "./prisma-transaction-repository.js";

/**
 * Integration test for `PrismaTransactionRepository`.
 * See prisma-portfolio-repository.test.ts for the shared preconditions
 * (Docker Postgres up and migrated).
 *
 * A dedicated user, portfolio and asset are created once for the whole
 * suite (transactions require valid FKs to both). Deleting the user at
 * teardown cascades through the portfolio to its transactions; the
 * asset is deleted separately since Transaction -> Asset uses
 * onDelete: Restrict (schema.prisma), so it must outlive every
 * transaction created against it and be cleaned up last.
 */
describe("PrismaTransactionRepository", () => {
  const repository = new PrismaTransactionRepository();

  let userId: string;
  let portfolioId: string;
  let assetId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `transaction-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Transaction Repository Test User",
      },
    });
    userId = user.id;

    const portfolio = await prisma.portfolio.create({
      data: { userId, name: "Test Portfolio", baseCurrency: "USD" },
    });
    portfolioId = portfolio.id;

    const asset = await prisma.asset.create({
      data: {
        symbol: `TXN-${crypto.randomUUID().slice(0, 8)}`,
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

  it("creates a transaction, defaulting fees to zero and status to DRAFT", async () => {
    const transaction = await repository.create({
      portfolioId,
      assetId,
      type: "BUY",
      quantity: 10,
      price: Money.of("150.25", "USD"),
    });

    expect(transaction.status).toBe("DRAFT");
    expect(transaction.quantity).toBe(10);
    expect(transaction.price.equals(Money.of("150.25", "USD"))).toBe(true);
    expect(transaction.fees.equals(Money.of("0", "USD"))).toBe(true);
    expect(transaction.executedAt).toBeInstanceOf(Date);
  });

  it("preserves decimal precision for price and fees through the round trip", async () => {
    const transaction = await repository.create({
      portfolioId,
      assetId,
      type: "BUY",
      quantity: 0.12345678,
      price: Money.of("184.87654321", "USD"),
      fees: Money.of("2.50000001", "USD"),
    });

    const found = await repository.getById(transaction.id);

    expect(found?.price.toString()).toBe("184.87654321");
    expect(found?.fees.toString()).toBe("2.50000001");
    expect(found?.quantity).toBeCloseTo(0.12345678, 8);
  });

  it("respects an explicit executedAt instead of defaulting to now", async () => {
    const explicitDate = new Date("2026-01-15T10:00:00.000Z");

    const transaction = await repository.create({
      portfolioId,
      assetId,
      type: "SELL",
      quantity: 1,
      price: Money.of("100", "USD"),
      executedAt: explicitDate,
    });

    expect(transaction.executedAt.toISOString()).toBe(explicitDate.toISOString());
  });

  it("lists transactions for a portfolio filtered by type and date range", async () => {
    const buy = await repository.create({
      portfolioId,
      assetId,
      type: "BUY",
      quantity: 1,
      price: Money.of("50", "USD"),
      executedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const results = await repository.listByPortfolioId(portfolioId, {
      type: "BUY",
      dateFrom: new Date("2026-02-01T00:00:00.000Z"),
      dateTo: new Date("2026-02-28T00:00:00.000Z"),
    });

    expect(results.some((t) => t.id === buy.id)).toBe(true);
    expect(results.every((t) => t.type === "BUY")).toBe(true);
  });

  it("returns null when a transaction does not exist", async () => {
    expect(await repository.getById("nonexistent-id")).toBeNull();
  });

  it("transitions status via updateStatus", async () => {
    const transaction = await repository.create({
      portfolioId,
      assetId,
      type: "BUY",
      quantity: 1,
      price: Money.of("10", "USD"),
    });

    const processing = await repository.updateStatus(transaction.id, "PROCESSING");
    expect(processing.status).toBe("PROCESSING");

    const completed = await repository.updateStatus(transaction.id, "COMPLETED");
    expect(completed.status).toBe("COMPLETED");
  });
});
