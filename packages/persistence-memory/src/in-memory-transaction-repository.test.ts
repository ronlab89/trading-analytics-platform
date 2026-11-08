import { describe, expect, it } from "vitest";
import { Money, TransactionStatus, TransactionType } from "@trading/domain";
import { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const page = { page: 1, pageSize: 10 };

function input(overrides: Record<string, unknown> = {}) {
  return {
    portfolioId: "p1",
    assetId: "a1",
    type: TransactionType.BUY,
    quantity: 5,
    price: Money.of("100", "USD"),
    executedAt: day(10),
    ...overrides,
  };
}

function build() {
  return new InMemoryTransactionRepository({ now: () => day(30) });
}

describe("InMemoryTransactionRepository", () => {
  it("creates a DRAFT transaction with an id, zero fees in the price currency and createdAt from now", async () => {
    const created = await build().create(input());
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({
      portfolioId: "p1",
      assetId: "a1",
      type: TransactionType.BUY,
      quantity: 5,
      status: TransactionStatus.DRAFT,
      executedAt: day(10),
      createdAt: day(30),
    });
    expect(created.fees).toEqual(Money.zero("USD"));
  });

  it("keeps explicit fees and falls back to now when executedAt is omitted", async () => {
    const created = await build().create(
      input({ fees: Money.of("2", "USD"), executedAt: undefined }),
    );
    expect(created.fees).toEqual(Money.of("2", "USD"));
    expect(created.executedAt).toEqual(day(30));
  });

  it("finds a transaction by id and returns null for an unknown id", async () => {
    const repository = build();
    const created = await repository.create(input());
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
  });

  it("lists one portfolio's transactions, most recent first, with the total", async () => {
    const repository = build();
    const old = await repository.create(input({ executedAt: day(2) }));
    const recent = await repository.create(input({ executedAt: day(20) }));
    await repository.create(input({ portfolioId: "p2" }));
    const result = await repository.listByPortfolioId("p1", {}, page);
    expect(result.items).toEqual([recent, old]);
    expect(result.total).toBe(2);
  });

  it("orders transactions that share an executedAt by creation, newest first, even past nine", async () => {
    const repository = build();
    const created = [];
    for (let i = 0; i < 11; i++) {
      created.push(await repository.create(input({ executedAt: day(10) })));
    }
    const result = await repository.listByPortfolioId("p1", {}, { page: 1, pageSize: 20 });
    expect(result.items.map((t) => t.id)).toEqual(created.map((t) => t.id).reverse());
  });

  it("lists one asset's transactions oldest first, ties by creation order, even past nine", async () => {
    const repository = build();
    const created = [];
    for (let i = 0; i < 11; i++) {
      created.push(await repository.create(input({ executedAt: day(10) })));
    }
    const earlier = await repository.create(input({ executedAt: day(2) }));
    const result = await repository.listByPortfolioAndAsset("p1", "a1");
    expect(result.map((t) => t.id)).toEqual([earlier, ...created].map((t) => t.id));
  });

  it("filters by asset, type and an inclusive date range", async () => {
    const repository = build();
    await repository.create(input({ assetId: "a1", executedAt: day(5) }));
    await repository.create(input({ assetId: "a2", executedAt: day(10) }));
    await repository.create(input({ type: TransactionType.SELL, executedAt: day(15) }));
    await repository.create(input({ executedAt: day(25) }));
    const found = async (filter: Parameters<typeof repository.listByPortfolioId>[1]) =>
      (await repository.listByPortfolioId("p1", filter, page)).items.map((t) => t.executedAt);

    expect(await found({ assetId: "a2" })).toEqual([day(10)]);
    expect(await found({ type: TransactionType.SELL })).toEqual([day(15)]);
    expect(await found({ dateFrom: day(10), dateTo: day(15) })).toEqual([day(15), day(10)]);
    expect(await found({ dateFrom: day(20) })).toEqual([day(25)]);
    expect(await found({ dateTo: day(5) })).toEqual([day(5)]);
  });

  it("paginates and reports the unpaged total", async () => {
    const repository = build();
    for (let n = 1; n <= 5; n++) {
      await repository.create(input({ executedAt: day(n) }));
    }
    const second = await repository.listByPortfolioId("p1", {}, { page: 2, pageSize: 2 });
    expect(second.items.map((t) => t.executedAt)).toEqual([day(3), day(2)]);
    expect(second.total).toBe(5);
  });

  it("updates the status only", async () => {
    const repository = build();
    const created = await repository.create(input());
    const updated = await repository.updateStatus(created.id, TransactionStatus.COMPLETED);
    expect(updated).toEqual({ ...created, status: TransactionStatus.COMPLETED });
    expect(await repository.getById(created.id)).toEqual(updated);
  });

  it("throws when updating the status of a transaction that does not exist", async () => {
    await expect(build().updateStatus("ghost", TransactionStatus.COMPLETED)).rejects.toThrow();
  });
});
