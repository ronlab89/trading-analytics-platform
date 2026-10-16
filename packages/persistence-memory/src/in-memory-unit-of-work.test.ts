import { describe, expect, it } from "vitest";
import { Money, TransactionType } from "@trading/domain";
import { InMemoryPositionRepository } from "./in-memory-position-repository.js";
import { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";
import { InMemoryUnitOfWork } from "./in-memory-unit-of-work.js";

const transactionInput = {
  portfolioId: "p1",
  assetId: "a1",
  type: TransactionType.BUY,
  quantity: 5,
  price: Money.of("100", "USD"),
  executedAt: new Date(Date.UTC(2026, 0, 10)),
};

const positionInput = {
  portfolioId: "p1",
  assetId: "a1",
  quantity: 5,
  averageEntryPrice: Money.of("100", "USD"),
  currentPrice: Money.of("110", "USD"),
};

function build() {
  const transactions = new InMemoryTransactionRepository();
  const positions = new InMemoryPositionRepository();
  const unitOfWork = new InMemoryUnitOfWork({ transactions, positions });
  return { transactions, positions, unitOfWork };
}

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("InMemoryUnitOfWork", () => {
  it("returns the result of the work and keeps its writes in the shared repositories", async () => {
    const { transactions, positions, unitOfWork } = build();

    const result = await unitOfWork.run(async (repositories) => {
      const created = await repositories.transactions.create(transactionInput);
      await repositories.positions.upsert(positionInput);
      return created.id;
    });

    expect(await transactions.getById(result)).not.toBeNull();
    expect(await positions.listByPortfolioId("p1")).toHaveLength(1);
  });

  it("rolls back the writes of every repository and rethrows the same error", async () => {
    const { transactions, positions, unitOfWork } = build();
    const failure = new Error("boom");
    let createdId = "";

    await expect(
      unitOfWork.run(async (repositories) => {
        createdId = (await repositories.transactions.create(transactionInput)).id;
        await repositories.positions.upsert(positionInput);
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await transactions.getById(createdId)).toBeNull();
    expect(await positions.listByPortfolioId("p1")).toEqual([]);
  });

  it("does not let a failed unit erase the writes of a unit that ran at the same time", async () => {
    const { positions, transactions, unitOfWork } = build();
    const gate = deferred();
    let failedId = "";

    const failing = unitOfWork.run(async (repositories) => {
      failedId = (await repositories.transactions.create(transactionInput)).id;
      await gate.promise;
      throw new Error("boom");
    });
    const succeeding = unitOfWork.run((repositories) =>
      repositories.positions.upsert(positionInput),
    );

    gate.release();
    await expect(failing).rejects.toThrow("boom");
    await succeeding;

    expect(await positions.listByPortfolioId("p1")).toHaveLength(1);
    expect(await transactions.getById(failedId)).toBeNull();
  });

  it("runs units one at a time, in the order they were requested", async () => {
    const { unitOfWork } = build();
    const gate = deferred();
    const events: string[] = [];

    const first = unitOfWork.run(async () => {
      events.push("first:start");
      await gate.promise;
      events.push("first:end");
    });
    const second = unitOfWork.run(() => {
      events.push("second:start");
      return Promise.resolve();
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    gate.release();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("lets a unit read what the unit before it wrote, so a read-check-write cannot race", async () => {
    const { unitOfWork } = build();
    const gate = deferred();
    const seen: number[] = [];

    // Each unit reads the history, waits, then writes: without serialization
    // both would read an empty history.
    const unit = (hold: boolean) =>
      unitOfWork.run(async ({ transactions }) => {
        seen.push((await transactions.listByPortfolioAndAsset("p1", "a1")).length);
        if (hold) await gate.promise;
        await transactions.create(transactionInput);
      });

    const first = unit(true);
    const second = unit(false);

    gate.release();
    await Promise.all([first, second]);

    expect(seen).toEqual([0, 1]);
  });

  it("keeps accepting units after one failed", async () => {
    const { unitOfWork } = build();

    await expect(unitOfWork.run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");

    expect(await unitOfWork.run(() => Promise.resolve("ok"))).toBe("ok");
  });
});
