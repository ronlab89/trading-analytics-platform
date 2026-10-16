import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Money, TransactionStatus, TransactionType } from "@trading/domain";
import type { CreateTransactionInput, TransactionRepository } from "@trading/domain";

export interface TransactionContractContext {
  readonly repository: TransactionRepository;
  readonly fixtures: {
    /** An existing portfolio that owns the transactions created by the suite. */
    readonly portfolioId: string;
    /** A second existing portfolio, to check listing is scoped by portfolio. */
    readonly otherPortfolioId: string;
    /** An existing asset the transactions are about. */
    readonly assetId: string;
    /** A second existing asset, to check the asset filter. */
    readonly otherAssetId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const page = { page: 1, pageSize: 10 };

/**
 * Behavior every `TransactionRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Every transaction the ordering, filter and pagination cases create has a
 * different `executedAt`, so the expected order is exact in every storage. The
 * order of transactions that share an instant is checked by the in-memory
 * tests, as are `snapshot` and `restore`. `createdAt` is only checked to be a
 * date: some storages take it from their own clock.
 */
export function transactionRepositoryContract(
  name: string,
  factory: () => Promise<TransactionContractContext>,
): void {
  describe(`${name} (TransactionRepository contract)`, () => {
    let context: TransactionContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const base = () => ({
      portfolioId: context.fixtures.portfolioId,
      assetId: context.fixtures.assetId,
      type: TransactionType.BUY,
      quantity: 5,
      price: Money.of("100", "USD"),
    });
    const input = (overrides: Partial<CreateTransactionInput> = {}) => ({
      ...base(),
      executedAt: day(10),
      ...overrides,
    });
    const executedAtOf = async (
      filter: Parameters<TransactionRepository["listByPortfolioId"]>[1],
    ) =>
      (
        await context.repository.listByPortfolioId(context.fixtures.portfolioId, filter, page)
      ).items.map((t) => t.executedAt);

    it("creates a DRAFT transaction with an id and zero fees in the price currency", async () => {
      const created = await context.repository.create(input());
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({
        ...base(),
        status: TransactionStatus.DRAFT,
        executedAt: day(10),
      });
      expect(created.fees.equals(Money.zero("USD"))).toBe(true);
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it("keeps explicit fees and uses the current time when executedAt is omitted", async () => {
      const explicit = await context.repository.create(input({ fees: Money.of("2", "USD") }));
      expect(explicit.fees).toEqual(Money.of("2", "USD"));
      const before = Date.now();
      const created = await context.repository.create(base());
      const after = Date.now();
      expect(created.executedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(created.executedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it("preserves the decimal precision of price, fees and quantity", async () => {
      const created = await context.repository.create(
        input({
          quantity: 0.12345678,
          price: Money.of("184.87654321", "USD"),
          fees: Money.of("2.50000001", "USD"),
        }),
      );
      const found = await context.repository.getById(created.id);
      expect(found?.price.toString()).toBe("184.87654321");
      expect(found?.fees.toString()).toBe("2.50000001");
      expect(found?.quantity).toBeCloseTo(0.12345678, 8);
    });

    it("finds a transaction by id and returns null for an unknown id", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
    });

    it("lists one portfolio's transactions, most recent first, with the total", async () => {
      const { portfolioId, otherPortfolioId } = context.fixtures;
      const empty = await context.repository.listByPortfolioId(portfolioId, {}, page);
      expect(empty).toEqual({ items: [], total: 0 });
      const old = await context.repository.create(input({ executedAt: day(2) }));
      const recent = await context.repository.create(input({ executedAt: day(20) }));
      await context.repository.create(input({ portfolioId: otherPortfolioId }));
      const result = await context.repository.listByPortfolioId(portfolioId, {}, page);
      expect(result.items).toEqual([recent, old]);
      expect(result.total).toBe(2);
    });

    it("filters by asset, type and an inclusive date range", async () => {
      await context.repository.create(input({ executedAt: day(5) }));
      await context.repository.create(
        input({ assetId: context.fixtures.otherAssetId, executedAt: day(10) }),
      );
      await context.repository.create(input({ type: TransactionType.SELL, executedAt: day(15) }));
      await context.repository.create(input({ executedAt: day(25) }));
      expect(await executedAtOf({ assetId: context.fixtures.otherAssetId })).toEqual([day(10)]);
      expect(await executedAtOf({ type: TransactionType.SELL })).toEqual([day(15)]);
      expect(await executedAtOf({ dateFrom: day(10), dateTo: day(15) })).toEqual([
        day(15),
        day(10),
      ]);
      expect(await executedAtOf({ dateFrom: day(20) })).toEqual([day(25)]);
      expect(await executedAtOf({ dateTo: day(5) })).toEqual([day(5)]);
    });

    it("paginates and reports the unpaged total", async () => {
      for (let n = 1; n <= 5; n++) {
        await context.repository.create(input({ executedAt: day(n) }));
      }
      const second = await context.repository.listByPortfolioId(
        context.fixtures.portfolioId,
        {},
        { page: 2, pageSize: 2 },
      );
      expect(second.items.map((t) => t.executedAt)).toEqual([day(3), day(2)]);
      expect(second.total).toBe(5);
    });

    it("lists one asset's transactions of a portfolio, oldest first", async () => {
      const { portfolioId, otherPortfolioId, otherAssetId } = context.fixtures;
      expect(await context.repository.listByPortfolioAndAsset(portfolioId, base().assetId)).toEqual(
        [],
      );
      const late = await context.repository.create(input({ executedAt: day(20) }));
      const early = await context.repository.create(input({ executedAt: day(2) }));
      await context.repository.create(input({ assetId: otherAssetId }));
      await context.repository.create(input({ portfolioId: otherPortfolioId }));
      const result = await context.repository.listByPortfolioAndAsset(portfolioId, base().assetId);
      expect(result).toEqual([early, late]);
    });

    it("updates the status only", async () => {
      const created = await context.repository.create(input());
      const processing = await context.repository.updateStatus(
        created.id,
        TransactionStatus.PROCESSING,
      );
      expect(processing).toEqual({ ...created, status: TransactionStatus.PROCESSING });
      const completed = await context.repository.updateStatus(
        created.id,
        TransactionStatus.COMPLETED,
      );
      expect(completed).toEqual({ ...created, status: TransactionStatus.COMPLETED });
      expect(await context.repository.getById(created.id)).toEqual(completed);
    });

    it("throws when updating the status of a transaction that does not exist", async () => {
      await expect(
        context.repository.updateStatus("nonexistent-id", TransactionStatus.COMPLETED),
      ).rejects.toThrow();
    });
  });
}
