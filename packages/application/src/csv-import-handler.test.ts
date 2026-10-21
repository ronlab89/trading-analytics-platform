import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Money, PortfolioStatus, TransactionStatus, TransactionType } from "@trading/domain";
import type {
  Asset,
  CreateTransactionInput,
  Job,
  Portfolio,
  Position,
  Transaction,
  TransactionalRepositories,
  UnitOfWork,
} from "@trading/domain";
import { fixedClock } from "./clock.js";
import { createCsvImportHandler } from "./csv-import-handler.js";
import type { CsvTokenizer } from "./csv-import.js";
import {
  JobApplyRejectedError,
  JobPortfolioArchivedError,
  JobSupersededError,
  createJobRunner,
} from "./job-runner.js";

const NOW = new Date("2026-06-15T12:00:00Z");
const HEADER = "symbol,type,quantity,price,fees,executedAt";

/** Splits on commas and newlines only; the real tokenizer is tested in the API. */
const tokenize: CsvTokenizer = (input) => ({
  records: input
    .split("\n")
    .map((text, index) => ({ line: index + 1, values: text.split(",").map((v) => v.trim()) }))
    .filter((record) => !(record.values.length === 1 && record.values[0] === "")),
  malformedLines: [],
});

const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

const asset = (id: string, symbol: string, currency = "USD"): Asset => ({
  id,
  symbol,
  name: symbol,
  assetType: "STOCK",
  currency,
  exchange: "X",
  status: "ACTIVE",
  metadata: {},
});

function job(input: string | null, overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    userId: "u1",
    portfolioId: "p1",
    type: "CSV_IMPORT",
    status: "QUEUED",
    stage: "QUEUED",
    attempt: 1,
    processed: 0,
    total: 0,
    failureReason: null,
    report: null,
    input,
    queuedAt: NOW,
    deadlineAt: new Date(NOW.getTime() + 5 * 60 * 1000),
    createdAt: NOW,
    updatedAt: NOW,
    finishedAt: null,
    ...overrides,
  };
}

function existing(
  id: string,
  assetId: string,
  type: TransactionType,
  quantity: number,
  price: string,
  executedAt: string,
): Transaction {
  return {
    id,
    portfolioId: "p1",
    assetId,
    type,
    quantity,
    price: Money.of(price, "USD"),
    fees: Money.zero("USD"),
    status: TransactionStatus.COMPLETED,
    executedAt: new Date(executedAt),
    createdAt: new Date(executedAt),
  };
}

interface Options {
  input?: string | null;
  history?: Transaction[];
  positions?: Position[];
  portfolioStatus?: PortfolioStatus;
  assets?: Asset[];
  failOnUpsert?: boolean;
  jobOverrides?: Partial<Job>;
}

/** The persisted state the import reads and writes, with a unit of work that really rolls back. */
function build(options: Options = {}) {
  const world = {
    transactions: [...(options.history ?? [])],
    positions: [...(options.positions ?? [])],
    job: job(options.input === undefined ? null : options.input, options.jobOverrides),
    portfolioStatus: options.portfolioStatus ?? PortfolioStatus.ACTIVE,
  };
  const assets = options.assets ?? [asset("a1", "AAPL"), asset("a2", "MSFT")];
  const locks: string[] = [];
  let sequence = 0;

  const transactions = {
    listByPortfolioAndAsset: (_portfolioId: string, assetId: string) =>
      Promise.resolve(world.transactions.filter((t) => t.assetId === assetId)),
    lockPortfolioAsset: (_portfolioId: string, assetId: string) => {
      locks.push(assetId);
      return Promise.resolve();
    },
    create: (input: CreateTransactionInput) => {
      sequence += 1;
      const created: Transaction = {
        id: `new-${sequence.toString()}`,
        portfolioId: input.portfolioId,
        assetId: input.assetId,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        fees: input.fees ?? Money.zero(input.price.currency),
        status: TransactionStatus.DRAFT,
        executedAt: input.executedAt ?? NOW,
        createdAt: NOW,
      };
      world.transactions.push(created);
      return Promise.resolve(created);
    },
    updateStatus: (id: string, status: TransactionStatus) => {
      const index = world.transactions.findIndex((t) => t.id === id);
      const updated = { ...world.transactions[index], status } as Transaction;
      world.transactions[index] = updated;
      return Promise.resolve(updated);
    },
  };

  const positions = {
    getByPortfolioAndAsset: (_p: string, assetId: string) =>
      Promise.resolve(world.positions.find((p) => p.assetId === assetId) ?? null),
    upsert: (input: Omit<Position, "id" | "updatedAt"> & { openedAt?: Date }) => {
      if (options.failOnUpsert) {
        return Promise.reject(new Error("db down"));
      }
      const next = { id: `pos-${input.assetId}`, updatedAt: NOW, ...input } as Position;
      world.positions = [...world.positions.filter((p) => p.assetId !== input.assetId), next];
      return Promise.resolve(next);
    },
    deleteByPortfolioAndAsset: (_p: string, assetId: string) => {
      world.positions = world.positions.filter((p) => p.assetId !== assetId);
      return Promise.resolve();
    },
  };

  const jobs = {
    listByStatuses: (statuses: readonly string[]) =>
      Promise.resolve(statuses.includes(world.job.status) ? [world.job] : []),
    transition: ({ expected, patch, updatedAt }: Parameters<UnitOfWorkJobs["transition"]>[0]) => {
      const current = world.job;
      if (
        current.status !== expected.status ||
        current.stage !== expected.stage ||
        current.attempt !== expected.attempt
      ) {
        return Promise.resolve(null);
      }
      world.job = { ...current, ...patch, updatedAt };
      return Promise.resolve(world.job);
    },
  };
  type UnitOfWorkJobs = TransactionalRepositories["jobs"];

  const unitOfWork: UnitOfWork = {
    run: async (work) => {
      const snapshot = {
        transactions: [...world.transactions],
        positions: [...world.positions],
        job: world.job,
      };
      try {
        return await work({
          transactions,
          positions,
          jobs,
        } as unknown as TransactionalRepositories);
      } catch (error) {
        world.transactions = snapshot.transactions;
        world.positions = snapshot.positions;
        world.job = snapshot.job;
        throw error;
      }
    },
  };

  const handler = createCsvImportHandler({
    tokenize,
    portfolioRepository: {
      getById: () =>
        Promise.resolve({
          id: "p1",
          baseCurrency: "USD",
          status: world.portfolioStatus,
        } as Portfolio),
    },
    assetRepository: {
      getBySymbol: (symbol) => Promise.resolve(assets.find((a) => a.symbol === symbol) ?? null),
    },
    transactionRepository: transactions,
    unitOfWork,
    clock: fixedClock(NOW),
  });

  /** The context the runner gives `apply`: completes the job through the unit's job repository. */
  const context = {
    complete: async (repository: Pick<TransactionalRepositories["jobs"], "transition">) =>
      (await repository.transition({
        id: world.job.id,
        expected: { status: world.job.status, stage: world.job.stage, attempt: world.job.attempt },
        patch: { status: "COMPLETED", input: null, finishedAt: NOW },
        updatedAt: NOW,
      })) !== null,
  };

  return { world, handler, context, locks, jobs };
}

const noProgress = () => Promise.resolve(true);

describe("csv import: validate", () => {
  it("accepts a clean file and counts its rows", async () => {
    const { handler } = build();

    const result = await handler.validate(
      job(csv("AAPL,BUY,10,100,1,2026-01-05", "MSFT,BUY,5,200,,2026-01-06")),
      noProgress,
    );

    expect(result).toEqual({ total: 2, errors: [] });
  });

  it("reports progress every 100 rows and at the end", async () => {
    const { handler } = build();
    const rows = Array.from({ length: 250 }, () => "AAPL,BUY,1,10,,2026-01-05");
    const report = vi.fn(noProgress);

    await handler.validate(job(csv(...rows)), report);

    expect(report.mock.calls).toEqual([
      [100, 250],
      [200, 250],
      [250, 250],
    ]);
  });

  it("stops as soon as the job is no longer validating", async () => {
    const { handler } = build();
    const rows = Array.from({ length: 250 }, () => "AAPL,BUY,1,10,,2026-01-05");
    const report = vi.fn(() => Promise.resolve(false));

    const result = await handler.validate(job(csv(...rows)), report);

    expect(report).toHaveBeenCalledTimes(1);
    expect(result.errors).toEqual([]);
  });

  it("reports every row problem with its row", async () => {
    const { handler } = build({ assets: [asset("a1", "AAPL"), asset("a3", "EURO", "EUR")] });

    const result = await handler.validate(
      job(
        csv(
          "AAPL,BUY,10,100,,2026-01-05",
          "GHOST,BUY,1,10,,2026-01-05",
          "EURO,BUY,1,10,,2026-01-05",
          "AAPL,BUY,1,10,,2030-01-01",
          "AAPL,SELL,1,10,20,2026-01-05",
        ),
      ),
      noProgress,
    );

    expect(result.errors).toEqual([
      { row: 3, message: "Unknown asset GHOST." },
      { row: 4, message: "EURO is in EUR but the portfolio is in USD." },
      { row: 5, message: "Execution date cannot be in the future." },
      { row: 6, message: "Fees cannot exceed the gross proceeds of a SELL." },
    ]);
  });

  it("reports only the format problems while the file does not parse", async () => {
    const { handler } = build();

    const result = await handler.validate(
      job(csv("AAPL,BUY,x,100,,2026-01-05", "GHOST,BUY,1,10,,2026-01-05")),
      noProgress,
    );

    expect(result.errors).toEqual([
      { row: 2, message: "The quantity must be a positive number with up to 8 decimals." },
    ]);
  });

  it("reports a missing input as a problem of the file", async () => {
    const { handler } = build();

    const result = await handler.validate(job(null), noProgress);

    expect(result.errors).toEqual([{ row: 0, message: "The file has no rows to import." }]);
  });

  describe("chronological check (ADR-003)", () => {
    const bought = existing("t0", "a1", TransactionType.BUY, 5, "100", "2026-01-01T00:00:00Z");

    it("accepts a SELL covered by the existing history", async () => {
      const { handler } = build({ history: [bought] });

      const result = await handler.validate(job(csv("AAPL,SELL,5,120,,2026-02-01")), noProgress);

      expect(result.errors).toEqual([]);
    });

    it("rejects a SELL that exceeds what is held, naming its row", async () => {
      const { handler } = build({ history: [bought] });

      const result = await handler.validate(job(csv("AAPL,SELL,6,120,,2026-02-01")), noProgress);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ row: 2 });
      expect(result.errors[0]?.message).toContain("Cannot sell 6 units");
    });

    it("judges rows by date, not by their order in the file", async () => {
      const { handler } = build();

      const result = await handler.validate(
        job(csv("AAPL,SELL,3,120,,2026-02-01", "AAPL,BUY,5,100,,2026-01-01")),
        noProgress,
      );

      expect(result.errors).toEqual([]);
    });

    it("rejects a SELL dated before the BUY that covers it", async () => {
      const { handler } = build();

      const result = await handler.validate(
        job(csv("AAPL,BUY,5,100,,2026-02-01", "AAPL,SELL,3,120,,2026-01-01")),
        noProgress,
      );

      expect(result.errors).toMatchObject([{ row: 3 }]);
    });

    it("still judges the rows after a failed SELL against what is really held", async () => {
      const { handler } = build();

      const result = await handler.validate(
        job(
          csv(
            "AAPL,BUY,2,100,,2026-01-01",
            "AAPL,SELL,5,120,,2026-01-02",
            "AAPL,SELL,2,120,,2026-01-03",
          ),
        ),
        noProgress,
      );

      expect(result.errors).toMatchObject([{ row: 3 }]);
    });

    it("skips the check while a row has a problem of its own", async () => {
      const { handler } = build();

      const result = await handler.validate(
        job(csv("AAPL,SELL,5,120,,2026-01-02", "GHOST,BUY,1,10,,2026-01-05")),
        noProgress,
      );

      expect(result.errors).toEqual([{ row: 3, message: "Unknown asset GHOST." }]);
    });
  });
});

describe("csv import: apply", () => {
  it("writes every row as completed in date order, rebuilds the position and completes the job", async () => {
    const { world, handler, context } = build({
      input: csv(
        "AAPL,SELL,4,150,,2026-02-01",
        "AAPL,BUY,10,100,10,2026-01-01",
        "MSFT,BUY,2,50,,2026-01-02",
      ),
    });

    await handler.apply(world.job, context);

    expect(world.transactions.map((t) => [t.assetId, t.type, t.executedAt.toISOString()])).toEqual([
      ["a1", "BUY", "2026-01-01T00:00:00.000Z"],
      ["a2", "BUY", "2026-01-02T00:00:00.000Z"],
      ["a1", "SELL", "2026-02-01T00:00:00.000Z"],
    ]);
    expect(world.transactions.every((t) => t.status === TransactionStatus.COMPLETED)).toBe(true);
    expect(world.positions.map((p) => [p.assetId, p.quantity])).toEqual([
      ["a1", 6],
      ["a2", 2],
    ]);
    expect(world.positions[0]?.averageEntryPrice.toString()).toBe(
      Money.of("101", "USD").toString(),
    );
    expect(world.job).toMatchObject({ status: "COMPLETED", input: null });
  });

  it("blends the imported rows into the position that already exists", async () => {
    const position: Position = {
      id: "pos-a1",
      portfolioId: "p1",
      assetId: "a1",
      quantity: 5,
      averageEntryPrice: Money.of("100", "USD"),
      currentPrice: Money.of("130", "USD"),
      openedAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: NOW,
    };
    const { world, handler, context } = build({
      input: csv("AAPL,BUY,5,120,,2026-03-01"),
      history: [existing("t0", "a1", TransactionType.BUY, 5, "100", "2026-01-01T00:00:00Z")],
      positions: [position],
    });

    await handler.apply(world.job, context);

    expect(world.positions[0]).toMatchObject({ quantity: 10 });
    expect(world.positions[0]?.averageEntryPrice.toString()).toBe(
      Money.of("110", "USD").toString(),
    );
    expect(world.positions[0]?.currentPrice.toString()).toBe(Money.of("130", "USD").toString());
  });

  it("closes the position when the rows sell everything", async () => {
    const position: Position = {
      id: "pos-a1",
      portfolioId: "p1",
      assetId: "a1",
      quantity: 5,
      averageEntryPrice: Money.of("100", "USD"),
      currentPrice: Money.of("130", "USD"),
      openedAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: NOW,
    };
    const { world, handler, context } = build({
      input: csv("AAPL,SELL,5,120,,2026-03-01"),
      history: [existing("t0", "a1", TransactionType.BUY, 5, "100", "2026-01-01T00:00:00Z")],
      positions: [position],
    });

    await handler.apply(world.job, context);

    expect(world.positions).toEqual([]);
    expect(world.job.status).toBe("COMPLETED");
  });

  it("locks the assets in id order so two imports cannot deadlock", async () => {
    const { world, handler, context, locks } = build({
      input: csv("MSFT,BUY,1,10,,2026-01-02", "AAPL,BUY,1,10,,2026-01-01"),
    });

    await handler.apply(world.job, context);

    expect(locks).toEqual(["a1", "a2"]);
  });

  describe("all or nothing", () => {
    it("writes nothing when the portfolio was archived, and says so", async () => {
      const { world, handler, context } = build({
        input: csv("AAPL,BUY,1,10,,2026-01-01"),
        portfolioStatus: PortfolioStatus.ARCHIVED,
      });
      const before = world.job;

      await expect(handler.apply(world.job, context)).rejects.toBeInstanceOf(
        JobPortfolioArchivedError,
      );

      expect(world.transactions).toEqual([]);
      expect(world.positions).toEqual([]);
      expect(world.job).toBe(before);
    });

    it("rejects, and writes nothing, when a SELL went stale after the validation", async () => {
      const { world, handler, context } = build({
        input: csv(
          "AAPL,BUY,2,10,,2026-01-01",
          "AAPL,SELL,2,12,,2026-01-02",
          "MSFT,BUY,1,10,,2026-01-03",
        ),
        // Another request sold in the meantime: here the history shows a SELL the file does not know.
        history: [
          existing("t0", "a1", TransactionType.BUY, 5, "100", "2025-12-01T00:00:00Z"),
          existing("t1", "a1", TransactionType.SELL, 5, "100", "2025-12-15T00:00:00Z"),
          existing("t2", "a1", TransactionType.SELL, 1, "100", "2026-01-01T12:00:00Z"),
        ],
      });
      const before = [...world.transactions];

      await expect(handler.apply(world.job, context)).rejects.toBeInstanceOf(JobApplyRejectedError);

      expect(world.transactions).toEqual(before);
      expect(world.positions).toEqual([]);
    });

    it("rolls back every row when the database fails part-way", async () => {
      const { world, handler, context } = build({
        input: csv("AAPL,BUY,1,10,,2026-01-01", "MSFT,BUY,1,10,,2026-01-02"),
        failOnUpsert: true,
      });

      await expect(handler.apply(world.job, context)).rejects.toThrow("db down");

      expect(world.transactions).toEqual([]);
      expect(world.positions).toEqual([]);
      expect(world.job.status).toBe("QUEUED");
    });

    it("rolls back when the job moved on before the completion", async () => {
      const { world, handler } = build({ input: csv("AAPL,BUY,1,10,,2026-01-01") });

      await expect(
        handler.apply(world.job, { complete: () => Promise.resolve(false) }),
      ).rejects.toBeInstanceOf(JobSupersededError);

      expect(world.transactions).toEqual([]);
      expect(world.positions).toEqual([]);
    });

    it("rejects a row whose asset disappeared, and writes nothing", async () => {
      const { world, handler, context } = build({
        input: csv("AAPL,BUY,1,10,,2026-01-01", "GHOST,BUY,1,10,,2026-01-02"),
      });

      await expect(handler.apply(world.job, context)).rejects.toBeInstanceOf(JobApplyRejectedError);

      expect(world.transactions).toEqual([]);
    });
  });
});

describe("csv import: run by the job runner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function run(options: Options) {
    const { world, handler, jobs } = build(options);
    const runner = createJobRunner({
      jobRepository: jobs,
      handlers: { CSV_IMPORT: handler },
      clock: { now: () => new Date() },
      pollIntervalMs: 1000,
    });
    runner.start();
    return { world, runner };
  }

  it("completes a valid import", async () => {
    const { world, runner } = run({ input: csv("AAPL,BUY,3,10,,2026-01-01") });

    await vi.advanceTimersByTimeAsync(0);

    expect(world.job).toMatchObject({ status: "COMPLETED", input: null, processed: 1, total: 1 });
    expect(world.transactions).toHaveLength(1);
    await runner.stop();
  });

  it("ends FAILED with VALIDATION_FAILED, the report and no input, writing nothing", async () => {
    const { world, runner } = run({ input: csv("GHOST,BUY,3,10,,2026-01-01") });

    await vi.advanceTimersByTimeAsync(0);

    expect(world.job).toMatchObject({
      status: "FAILED",
      failureReason: "VALIDATION_FAILED",
      input: null,
      report: [{ row: 2, message: "Unknown asset GHOST." }],
    });
    expect(world.transactions).toEqual([]);
    await runner.stop();
  });

  it("ends FAILED with PORTFOLIO_ARCHIVED and no input when the portfolio is archived", async () => {
    const { world, runner } = run({
      input: csv("AAPL,BUY,3,10,,2026-01-01"),
      portfolioStatus: PortfolioStatus.ARCHIVED,
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(world.job).toMatchObject({
      status: "FAILED",
      failureReason: "PORTFOLIO_ARCHIVED",
      input: null,
    });
    expect(world.transactions).toEqual([]);
    await runner.stop();
  });

  it("ends FAILED with APPLY_ERROR and keeps the input when the database fails", async () => {
    const { world, runner } = run({
      input: csv("AAPL,BUY,3,10,,2026-01-01"),
      failOnUpsert: true,
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(world.job).toMatchObject({
      status: "FAILED",
      failureReason: "APPLY_ERROR",
      input: csv("AAPL,BUY,3,10,,2026-01-01"),
    });
    expect(world.transactions).toEqual([]);
    await runner.stop();
  });
});
