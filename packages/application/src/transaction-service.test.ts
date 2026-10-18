import { describe, expect, it } from "vitest";
import {
  InsufficientPositionQuantityError,
  InvalidTransactionError,
  Money,
  PortfolioStatus,
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
import { ConflictError, ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createTransactionService } from "./transaction-service.js";

const actor: Actor = { userId: "u1", role: "TRADER" };

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
  /** Order of the lock and the history read inside the unit of work. */
  reads: string[];
}

function build(
  options: {
    ownedPortfolios?: string[];
    archivedPortfolios?: string[];
    assetExists?: boolean;
    /** Currencies of the portfolio and of the asset; both USD unless a test says otherwise. */
    baseCurrency?: string;
    assetCurrency?: string;
    stored?: Transaction[];
    /** Every COMPLETED transaction of the portfolio, read to replay the realized P/L; defaults to `stored`. */
    completed?: Transaction[];
    /** The asset's existing transactions, in creation order, read for the chronological check. */
    history?: Transaction[];
    existing?: Position | null;
    failOnStatus?: boolean;
  } = {},
) {
  const {
    ownedPortfolios = ["p1"],
    archivedPortfolios = [],
    assetExists = true,
    baseCurrency = "USD",
    assetCurrency = "USD",
    stored = [],
    completed = stored,
    history = [],
    existing = null,
  } = options;
  const calls: Calls = { upserts: [], deletes: [], statusUpdates: [], reads: [] };

  let created: Transaction | null = null;
  const transactions = {
    listByPortfolioId: () => Promise.resolve({ items: stored, total: stored.length }),
    listCompletedByPortfolioId: () => Promise.resolve(completed),
    lockPortfolioAsset: () => {
      calls.reads.push("lock");
      return Promise.resolve();
    },
    listByPortfolioAndAsset: () => {
      calls.reads.push("history");
      return Promise.resolve(history);
    },
    getById: (id: string) => Promise.resolve(stored.find((t) => t.id === id) ?? null),
    create: (input: Partial<Transaction> & { portfolioId: string; assetId: string }) => {
      created = { ...transaction("new", input.portfolioId), ...input, id: "new" };
      return Promise.resolve(created);
    },
    updateStatus: (id: string, status: TransactionStatus) => {
      if (options.failOnStatus) return Promise.reject(new Error("db down"));
      calls.statusUpdates.push(id);
      return Promise.resolve({ ...(created ?? transaction(id, "p1")), id, status });
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
        ? Promise.resolve(
            archivedPortfolios.includes(portfolioId)
              ? { status: PortfolioStatus.ARCHIVED, baseCurrency }
              : { baseCurrency },
          )
        : Promise.reject(new NotFoundError("The requested resource could not be found.")),
  };
  const service = createTransactionService({
    transactionRepository: transactions,
    assetRepository: {
      getById: () =>
        Promise.resolve(assetExists ? ({ id: "a1", currency: assetCurrency } as Asset) : null),
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
    expect(page.items[0]?.transaction.id).toBe("t1");
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

  describe("realized P/L", () => {
    const done = (
      id: string,
      type: TransactionType,
      quantity: number,
      price: string,
      day: string,
    ) => ({
      ...entry(id, type, quantity, `${day}T00:00:00Z`),
      price: Money.of(price, "USD"),
      status: TransactionStatus.COMPLETED,
    });
    const bought = done("b1", TransactionType.BUY, 10, "10", "2026-03-01");
    const sold = done("s1", TransactionType.SELL, 4, "12", "2026-03-02");

    it("lists each SELL with the P/L it realized and a BUY with none", async () => {
      const { service } = build({ stored: [bought, sold], completed: [bought, sold] });
      const page = await service.listTransactions(actor, "p1", {}, { page: 1, pageSize: 10 });

      expect(page.items.map((item) => item.realizedPnL?.toString() ?? null)).toEqual([null, "8"]);
    });

    it("replays the whole history, not only the page that is shown", async () => {
      // The page holds the SELL alone; the BUY that sets its cost is on another page.
      const { service } = build({ stored: [sold], completed: [bought, sold] });
      const page = await service.listTransactions(actor, "p1", {}, { page: 2, pageSize: 1 });

      expect(page.items[0]?.realizedPnL?.toString()).toBe("8");
    });

    it("returns the P/L of one SELL", async () => {
      const { service } = build({ stored: [sold], completed: [bought, sold] });
      const result = await service.getTransactionById(actor, "p1", "s1");

      expect(result.realizedPnL?.toString()).toBe("8");
    });

    it("returns the P/L a new SELL realizes, against the average cost at its place in date order", async () => {
      const { service } = build({ history: [bought] });
      const result = await service.createTransaction(actor, "p1", {
        ...buy,
        type: TransactionType.SELL,
        quantity: 4,
        price: Money.of("12", "USD"),
        fees: Money.of("1", "USD"),
        executedAt: new Date("2026-03-05T00:00:00Z"),
      });

      // 4 x (12 - 10) - 1 fee.
      expect(result.realizedPnL?.toString()).toBe("7");
    });

    it("returns no P/L for a new BUY", async () => {
      const { service } = build();
      const result = await service.createTransaction(actor, "p1", buy);

      expect(result.realizedPnL).toBeNull();
    });
  });

  describe("single currency (ADR-004 point 12)", () => {
    it("rejects an asset in another currency than the portfolio base currency and writes nothing", async () => {
      const { service, calls } = build({ baseCurrency: "USD", assetCurrency: "EUR" });
      const error = await service.createTransaction(actor, "p1", buy).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(InvalidTransactionError);
      expect((error as Error).message).toBe(
        "The asset is in EUR but the portfolio is in USD: version 1 is single-currency.",
      );
      expect(calls.reads).toHaveLength(0);
      expect(calls.upserts).toHaveLength(0);
      expect(calls.statusUpdates).toHaveLength(0);
    });

    it("accepts an asset in the portfolio base currency", async () => {
      const { service } = build({ baseCurrency: "EUR", assetCurrency: "EUR" });
      const result = await service.createTransaction(actor, "p1", {
        ...buy,
        price: Money.of("100", "EUR"),
      });
      expect(result.transaction.status).toBe(TransactionStatus.COMPLETED);
    });

    it("keeps answering 404 for an unknown asset before comparing currencies", async () => {
      const { service } = build({ assetExists: false, baseCurrency: "USD", assetCurrency: "EUR" });
      await expect(service.createTransaction(actor, "p1", buy)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("archived portfolio guard (ADR-010 point 5)", () => {
    it("rejects creating a transaction in an archived portfolio and writes nothing", async () => {
      const { service, calls } = build({ archivedPortfolios: ["p1"] });
      const error = await service.createTransaction(actor, "p1", buy).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe("An archived portfolio cannot be modified.");
      expect(calls.reads).toHaveLength(0);
      expect(calls.upserts).toHaveLength(0);
      expect(calls.deletes).toHaveLength(0);
      expect(calls.statusUpdates).toHaveLength(0);
    });

    it("still lists and reads the transactions of an archived portfolio", async () => {
      const { service } = build({
        archivedPortfolios: ["p1"],
        stored: [transaction("t1", "p1")],
      });
      const page = await service.listTransactions(actor, "p1", {}, { page: 1, pageSize: 10 });
      expect(page.total).toBe(1);
      expect((await service.getTransactionById(actor, "p1", "t1")).transaction.id).toBe("t1");
    });

    it("keeps answering 404 for a portfolio of another user, archived or not", async () => {
      const { service } = build({ ownedPortfolios: [], archivedPortfolios: ["p1"] });
      await expect(service.createTransaction(actor, "p1", buy)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  it("locks the portfolio and asset before it reads the history", async () => {
    const { service, calls } = build();
    await service.createTransaction(actor, "p1", buy);
    expect(calls.reads).toEqual(["lock", "history"]);
  });

  describe("position replay", () => {
    interface UpsertedPosition {
      quantity: number;
      averageEntryPrice: Money;
      currentPrice: Money;
      openedAt: Date;
    }

    it("upserts the replayed average and the earliest openedAt for a backdated BUY", async () => {
      // Date order: BUY 10@100 (day 1), BUY 6@200 (day 2), SELL 4 (day 3):
      // (1000 + 1200) / 16 = 137.5, not the 150 an incremental BUY would give.
      const existing = { ...position(), quantity: 6, averageEntryPrice: Money.of("100", "USD") };
      const { service, calls } = build({
        existing,
        history: [
          entry("t1", TransactionType.BUY, 10, "2026-03-01T00:00:00Z"),
          entry("t2", TransactionType.SELL, 4, "2026-03-03T00:00:00Z"),
        ],
      });
      await service.createTransaction(actor, "p1", {
        ...buy,
        quantity: 6,
        price: Money.of("200", "USD"),
        executedAt: new Date("2026-03-02T00:00:00Z"),
      });
      const upserted = calls.upserts[0] as UpsertedPosition;
      expect(upserted.quantity).toBe(12);
      expect(upserted.averageEntryPrice.equals(Money.of("137.5", "USD"))).toBe(true);
      expect(upserted.openedAt).toEqual(new Date("2026-03-01T00:00:00Z"));
    });

    it("keeps the market price of an existing position", async () => {
      const existing = {
        ...position(),
        quantity: 2,
        averageEntryPrice: Money.of("100", "USD"),
        currentPrice: Money.of("120", "USD"),
      };
      const { service, calls } = build({ existing, history: [transaction("t0", "p1")] });
      await service.createTransaction(actor, "p1", buy);
      const upserted = calls.upserts[0] as UpsertedPosition;
      expect(upserted.currentPrice.equals(Money.of("120", "USD"))).toBe(true);
    });

    it("seeds the market price from the trade price when the position first opens", async () => {
      const { service, calls } = build();
      await service.createTransaction(actor, "p1", buy);
      const upserted = calls.upserts[0] as UpsertedPosition;
      expect(upserted.currentPrice.equals(Money.of("100", "USD"))).toBe(true);
    });
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
      TRADER: new Set(
        PERMISSIONS.filter((p) => p !== "transaction:create" && p !== "transaction:read"),
      ),
      VIEWER: new Set(PERMISSIONS),
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
