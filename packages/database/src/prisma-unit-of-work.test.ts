import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { prisma } from "./client.js";
import { PrismaTransactionRepository } from "./repositories/prisma-transaction-repository.js";
import { PrismaUnitOfWork } from "./prisma-unit-of-work.js";

/**
 * Integration test for `PrismaUnitOfWork`.
 * Same preconditions as the repository tests (Docker Postgres migrated).
 */
describe("PrismaUnitOfWork", () => {
  const unitOfWork = new PrismaUnitOfWork();
  const reader = new PrismaTransactionRepository();

  let userId: string;
  let portfolioId: string;
  let assetId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `uow-test-${crypto.randomUUID()}@example.com`,
        displayName: "Unit of Work Test User",
      },
    });
    userId = user.id;

    const portfolio = await prisma.portfolio.create({
      data: { userId, name: "UoW Portfolio", baseCurrency: "USD" },
    });
    portfolioId = portfolio.id;

    const asset = await prisma.asset.create({
      data: {
        symbol: `UOW-${crypto.randomUUID().slice(0, 8)}`,
        name: "UoW Test Asset",
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

  it("commits all writes when work resolves", async () => {
    const created = await unitOfWork.run(async ({ transactions }) =>
      transactions.create({
        portfolioId,
        assetId,
        type: "BUY",
        quantity: 1,
        price: Money.of("10", "USD"),
      }),
    );

    expect(await reader.getById(created.id)).not.toBeNull();
  });

  it("rolls back every write and rethrows the original error when work throws", async () => {
    const marker = new Error("boom");
    const captured: { id: string | null } = { id: null };

    await expect(
      unitOfWork.run(async ({ transactions, positions }) => {
        const tx = await transactions.create({
          portfolioId,
          assetId,
          type: "BUY",
          quantity: 2,
          price: Money.of("20", "USD"),
        });
        captured.id = tx.id;
        await positions.upsert({
          portfolioId,
          assetId,
          quantity: 2,
          averageEntryPrice: Money.of("20", "USD"),
          currentPrice: Money.of("20", "USD"),
        });
        throw marker;
      }),
    ).rejects.toBe(marker);

    if (captured.id === null) {
      throw new Error("Transaction was never created inside the unit of work.");
    }
    expect(await reader.getById(captured.id)).toBeNull();
    const position = await prisma.position.findUnique({
      where: { portfolioId_assetId: { portfolioId, assetId } },
    });
    expect(position).toBeNull();
  });

  describe("jobs and idempotency keys", () => {
    const reservedAt = new Date("2026-10-21T10:00:00.000Z");
    const queued = { status: "QUEUED", stage: "QUEUED", attempt: 1 } as const;

    async function setup() {
      const job = await prisma.job.create({
        data: {
          userId,
          portfolioId,
          type: "CSV_IMPORT",
          input: "date,type\n",
          queuedAt: reservedAt,
          deadlineAt: new Date("2026-10-21T10:05:00.000Z"),
        },
      });
      const key = `uow-${crypto.randomUUID()}`;
      await prisma.idempotencyKey.create({
        data: {
          userId,
          key,
          requestHash: "hash-1",
          leaseExpiresAt: new Date("2026-10-21T10:01:00.000Z"),
          expiresAt: new Date("2026-10-22T10:00:00.000Z"),
        },
      });
      return { job, key };
    }

    it("commits a job completion and an idempotency completion together", async () => {
      const { job, key } = await setup();

      await unitOfWork.run(async ({ jobs, idempotencyKeys }) => {
        await jobs.transition({
          id: job.id,
          expected: queued,
          patch: { status: "COMPLETED" },
          updatedAt: reservedAt,
        });
        await idempotencyKeys.complete({ userId, key, responseStatus: 201, responseBody: {} });
      });

      expect((await prisma.job.findUnique({ where: { id: job.id } }))?.status).toBe("COMPLETED");
      expect(
        (await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } }))
          ?.status,
      ).toBe("COMPLETED");
    });

    it("rolls back both when work throws", async () => {
      const { job, key } = await setup();

      await expect(
        unitOfWork.run(async ({ jobs, idempotencyKeys }) => {
          await jobs.transition({
            id: job.id,
            expected: queued,
            patch: { status: "COMPLETED" },
            updatedAt: reservedAt,
          });
          await idempotencyKeys.complete({ userId, key, responseStatus: 201, responseBody: {} });
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      expect((await prisma.job.findUnique({ where: { id: job.id } }))?.status).toBe("QUEUED");
      expect(
        (await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } }))
          ?.status,
      ).toBe("RESERVED");
    });
  });
});
