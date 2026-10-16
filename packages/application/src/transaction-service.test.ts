import { describe, expect, it } from "vitest";
import {
  InsufficientPositionQuantityError,
  InvalidTransactionError,
  Money,
  TransactionStatus,
  TransactionType,
} from "@trading/domain";
import type {
  Asset,
  Position,
  Transaction,
  TransactionalRepositories,
  UnitOfWork,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import { fixedClock } from "./clock.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createTransactionService } from "./transaction-service.js";

const actor: Actor = { userId: "u1", role: "USER" };

function transaction(id: string, portfolioId: string): Transaction {
  return {
    id,
    portfolioId,
    assetId: "a1",
    type: TransactionType.BUY,
    quantity: 2,
    price: Money.of("100", "USD"),
    fees: Money.of("0", "USD"),
    status: TransactionStatus.DRAFT,
    executedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

interface Calls {
  upserts: unknown[];
  deletes: string[];
  statusUpdates: string[];
}

function build(
  options: {
    ownedPortfolios?: string[];
    assetExists?: boolean;
    stored?: Transaction[];
    /** The asset's existing transactions, in creation order, read for the chronological check. */
    history?: Transaction[];
    existing?: Position | null;
    failOnStatus?: boolean;
  } = {},
) {
  const {
    ownedPortfolios = ["p1"],
    assetExists = true,
    stored = [],
    history = [],
    existing = null,
  } = options;
  const calls: Calls = { upserts: [], deletes: [], statusUpdates: [] };

  const transactions = {
    listByPortfolioId: () => Promise.resolve({ items: stored, total: stored.length }),
    listByPortfolioAndAsset: () => Promise.resolve(history),
    getById: (id: string) => Promise.resolve(stored.find((t) => t.id === id) ?? null),
    create: (input: { portfolioId: string; assetId: string }) =>
      Promise.resolve({ ...transaction("new", input.portfolioId), assetId: input.assetId }),
    updateStatus: (id: string, status: TransactionStatus) => {
      if (options.failOnStatus) return Promise.reject(new Error("db down"));
      calls.statusUpdates.push(id);
      return Promise.resolve({ ...transaction(id, "p1"), status });
    },
  };
  const positions = {
    getByPortfolioAndAsset: () => Promise.resolve(existing),
    upsert: (input: Record<string, unknown>) => {
      calls.upserts.push(input);
      return Promise.resolve({ ...position(), ...input });
    },
    deleteByPortfolioAndAsset: (portfolioId: string) => {
      calls.deletes.push(portfolioId);
      return Promise.resolve();
    },
  };
  const unitOfWork: UnitOfWork = {
    run: (work) => work({ transactions, positions } as unknown as TransactionalRepositories),
  };
  const portfolioService = {
    getPortfolioById: (_actor: Actor, portfolioId: string) =>
      ownedPortfolios.includes(portfolioId)
        ? Promise.resolve({})
        : Promise.reject(new NotFoundError("The requested resource could not be found.")),
  };
  const service = createTransactionService({
    transactionRepository: transactions,
    assetRepository: {
      getById: () => Promise.resolve(assetExists ? ({ id: "a1" } as Asset) : null),
    },
    unitOfWork,
    portfolioService: portfolioService as never,
    clock: fixedClock(new Date("2026-06-15T12:00:00Z")),
  });
  return { service, calls };
}

function entry(
  id: string,
  type: TransactionType,
  quantity: number,
  executedAt: string,
): Transaction {
  return { ...transaction(id, "p1"), type, quantity, executedAt: new Date(executedAt) };
}

function position(): Position {
  return {
    id: "pos",
    portfolioId: "p1",
    assetId: "a1",
    quantity: 0,
    averageEntryPrice: Money.of("0", "USD"),
    currentPrice: Money.of("0", "USD"),
    openedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const buy = {
  assetId: "a1",
  type: TransactionType.BUY,
  quantity: 2,
  price: Money.of("100", "USD"),
};

describe("transaction service", () => {
  it("lists the transactions of an owned portfolio", async () => {
    const { service } = build({ stored: [transaction("t1", "p1")] });
    const page = await service.listTransactions(actor, "p1", {}, { page: 1, pageSize: 10 });
    expect(page.total).toBe(1);
  });

  it("does not list transactions of a portfolio the actor does not own", async () => {
    const { service } = build({ ownedPortfolios: [] });
    await expect(
      service.listTransactions(actor, "p1", {}, { page: 1, pageSize: 10 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("raises NotFoundError for a transaction that belongs to another portfolio", async () => {
    const { service } = build({ ownedPortfolios: ["p1", "p2"], stored: [transaction("t1", "p2")] });
    const error = await service.getTransactionById(actor, "p1", "t1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
  });

  it("creates a transaction, upserts the position and marks it COMPLETED", async () => {
    const { service, calls } = build();
    const result = await service.createTransaction(actor, "p1", buy);
    expect(result.transaction.status).toBe(TransactionStatus.COMPLETED);
    expect(result.position).not.toBeNull();
    expect(calls.upserts).toHaveLength(1);
    expect(calls.statusUpdates).toEqual(["new"]);
  });

  it("deletes the position when a SELL closes it exactly", async () => {
    const existing = { ...position(), quantity: 2, averageEntryPrice: Money.of("100", "USD") };
    const { service, calls } = build({ existing, history: [transaction("t0", "p1")] });
    const result = await service.createTransaction(actor, "p1", {
      ...buy,
      type: TransactionType.SELL,
    });
    expect(result.position).toBeNull();
    expect(calls.deletes).toEqual(["p1"]);
    expect(calls.upserts).toHaveLength(0);
  });

  describe("chronological validation (FR-018)", () => {
    // BUY 5 on day 1, SELL 5 on day 3, BUY 10 on day 4: 10 held now, so the
    // current-position check alone would accept a SELL 5 dated day 2.
    const history = [
      entry("t1", TransactionType.BUY, 5, "2026-03-01T00:00:00Z"),
      entry("t2", TransactionType.SELL, 5, "2026-03-03T00:00:00Z"),
      entry("t3", TransactionType.BUY, 10, "2026-03-04T00:00:00Z"),
    ];
    const existing = { ...position(), quantity: 10, averageEntryPrice: Money.of("100", "USD") };

    it("rejects a SELL dated before the only BUY and writes nothing", async () => {
      const { service, calls } = build({
        existing,
        history: [entry("t1", TransactionType.BUY, 10, "2026-03-02T00:00:00Z")],
      });
      await expect(
        service.createTransaction(actor, "p1", {
          ...buy,
          type: TransactionType.SELL,
          quantity: 5,
          executedAt: new Date("2026-03-01T00:00:00Z"),
        }),
      ).rejects.toBeInstanceOf(InsufficientPositionQuantityError);
      expect(calls.upserts).toHaveLength(0);
      expect(calls.deletes).toHaveLength(0);
      expect(calls.statusUpdates).toHaveLength(0);
    });

    it("accepts a backdated BUY", async () => {
      const { service } = build({
        existing,
        history: [entry("t1", TransactionType.BUY, 10, "2026-03-02T00:00:00Z")],
      });
      const result = await service.createTransaction(actor, "p1", {
        ...buy,
        executedAt: new Date("2026-03-01T00:00:00Z"),
      });
      expect(result.transaction.status).toBe(TransactionStatus.COMPLETED);
    });

    it("rejects a backdated SELL that would make a later SELL oversell", async () => {
      const { service, calls } = build({ existing, history });
      await expect(
        service.createTransaction(actor, "p1", {
          ...buy,
          type: TransactionType.SELL,
          quantity: 5,
          executedAt: new Date("2026-03-02T00:00:00Z"),
        }),
      ).rejects.toBeInstanceOf(InsufficientPositionQuantityError);
      expect(calls.upserts).toHaveLength(0);
      expect(calls.statusUpdates).toHaveLength(0);
    });

    it("validates at the clock time when executedAt is omitted", async () => {
      // The clock is 2026-06-15; the only BUY is dated after it.
      const { service } = build({
        existing,
        history: [entry("t1", TransactionType.BUY, 10, "2026-06-20T00:00:00Z")],
      });
      await expect(
        service.createTransaction(actor, "p1", {
          ...buy,
          type: TransactionType.SELL,
          quantity: 5,
        }),
      ).rejects.toBeInstanceOf(InsufficientPositionQuantityError);
    });
  });

  it("raises NotFoundError with the asset message for an unknown asset", async () => {
    const { service } = build({ assetExists: false });
    const error = await service.createTransaction(actor, "p1", buy).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The referenced asset could not be found.");
  });

  it("rejects an execution date after the injected clock and writes nothing", async () => {
    const { service, calls } = build();
    await expect(
      service.createTransaction(actor, "p1", {
        ...buy,
        executedAt: new Date("2026-07-01T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
    expect(calls.upserts).toHaveLength(0);
    expect(calls.statusUpdates).toHaveLength(0);
  });

  it("propagates a failure inside the unit of work", async () => {
    const { service } = build({ failOnStatus: true });
    await expect(service.createTransaction(actor, "p1", buy)).rejects.toThrow("db down");
  });

  it("needs transaction:create to create and transaction:read to read", async () => {
    const restricted: RolePermissions = {
      USER: new Set(
        PERMISSIONS.filter((p) => p !== "transaction:create" && p !== "transaction:read"),
      ),
      ADMIN: new Set(PERMISSIONS),
    };
    const service = createTransactionService({
      transactionRepository: {} as never,
      assetRepository: {} as never,
      unitOfWork: {} as never,
      portfolioService: {} as never,
      clock: fixedClock(new Date("2026-06-15T12:00:00Z")),
      permissions: restricted,
    });
    await expect(service.createTransaction(actor, "p1", buy)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(service.getTransactionById(actor, "p1", "t1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      service.listTransactions(actor, "p1", {}, { page: 1, pageSize: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
