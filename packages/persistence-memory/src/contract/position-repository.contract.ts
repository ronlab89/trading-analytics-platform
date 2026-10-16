import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { PositionRepository } from "@trading/domain";

export interface PositionContractContext {
  readonly repository: PositionRepository;
  readonly fixtures: {
    /** An existing portfolio that owns the positions created by the suite. */
    readonly portfolioId: string;
    /** A second existing portfolio, to check positions are scoped by portfolio. */
    readonly otherPortfolioId: string;
    /** An existing asset to hold positions in. */
    readonly assetId: string;
    /** A second existing asset. */
    readonly otherAssetId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `PositionRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * A portfolio holds one position per asset. Listing is only checked as a set:
 * the storages do not promise the same order. Whether `openedAt` equals
 * `updatedAt` on a new position depends on the storage clock, so it is
 * checked by the in-memory tests, as are `snapshot` and `restore`.
 * Amounts have no trailing zeros, so they read back identical whatever the
 * storage keeps for decimals.
 */
export function positionRepositoryContract(
  name: string,
  factory: () => Promise<PositionContractContext>,
): void {
  describe(`${name} (PositionRepository contract)`, () => {
    let context: PositionContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (portfolioId: string, assetId: string, quantity = 10) => ({
      portfolioId,
      assetId,
      quantity,
      averageEntryPrice: Money.of("100", "USD"),
      currentPrice: Money.of("110", "USD"),
    });
    const idsOf = async (portfolioId: string) =>
      (await context.repository.listByPortfolioId(portfolioId)).map((p) => p.id).sort();

    it("opens a position with an id and every field", async () => {
      const { portfolioId, assetId } = context.fixtures;
      const created = await context.repository.upsert(input(portfolioId, assetId));
      expect(created.id).not.toBe("");
      expect(created).toMatchObject(input(portfolioId, assetId));
      expect(created.openedAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("updates the position of the same portfolio and asset, keeping id and openedAt", async () => {
      const { portfolioId, assetId } = context.fixtures;
      const opened = await context.repository.upsert(input(portfolioId, assetId, 10));
      const updated = await context.repository.upsert({
        ...input(portfolioId, assetId, 15),
        averageEntryPrice: Money.of("104", "USD"),
        currentPrice: Money.of("120", "USD"),
      });
      expect(updated.id).toBe(opened.id);
      expect(updated.quantity).toBe(15);
      expect(updated.averageEntryPrice).toEqual(Money.of("104", "USD"));
      expect(updated.currentPrice).toEqual(Money.of("120", "USD"));
      expect(updated.openedAt).toEqual(opened.openedAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(opened.updatedAt.getTime());
      expect(await idsOf(portfolioId)).toEqual([opened.id]);
    });

    it("finds a position by id and by portfolio and asset, and returns null otherwise", async () => {
      const { portfolioId, otherPortfolioId, assetId, otherAssetId } = context.fixtures;
      const created = await context.repository.upsert(input(portfolioId, assetId));
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
      expect(await context.repository.getByPortfolioAndAsset(portfolioId, assetId)).toEqual(
        created,
      );
      expect(await context.repository.getByPortfolioAndAsset(portfolioId, otherAssetId)).toBeNull();
      expect(await context.repository.getByPortfolioAndAsset(otherPortfolioId, assetId)).toBeNull();
    });

    it("lists only the positions of the given portfolio", async () => {
      const { portfolioId, otherPortfolioId, assetId, otherAssetId } = context.fixtures;
      expect(await idsOf(portfolioId)).toEqual([]);
      const first = await context.repository.upsert(input(portfolioId, assetId));
      const second = await context.repository.upsert(input(portfolioId, otherAssetId));
      const other = await context.repository.upsert(input(otherPortfolioId, assetId));
      expect(await idsOf(portfolioId)).toEqual([first.id, second.id].sort());
      expect(await idsOf(otherPortfolioId)).toEqual([other.id]);
    });

    it("updates the current price only", async () => {
      const { portfolioId, assetId } = context.fixtures;
      const created = await context.repository.upsert(input(portfolioId, assetId));
      const updated = await context.repository.updateCurrentPrice(
        created.id,
        Money.of("999.99", "USD"),
      );
      expect(updated.currentPrice).toEqual(Money.of("999.99", "USD"));
      expect(updated.quantity).toBe(created.quantity);
      expect(updated.averageEntryPrice).toEqual(created.averageEntryPrice);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("deletes the position of a portfolio and asset and leaves the others", async () => {
      const { portfolioId, otherPortfolioId, assetId, otherAssetId } = context.fixtures;
      await context.repository.upsert(input(portfolioId, assetId));
      const kept = await context.repository.upsert(input(portfolioId, otherAssetId));
      const otherPortfolio = await context.repository.upsert(input(otherPortfolioId, assetId));
      await context.repository.deleteByPortfolioAndAsset(portfolioId, assetId);
      expect(await context.repository.getByPortfolioAndAsset(portfolioId, assetId)).toBeNull();
      expect(await idsOf(portfolioId)).toEqual([kept.id]);
      expect(await idsOf(otherPortfolioId)).toEqual([otherPortfolio.id]);
    });

    it("throws when updating the price of, or deleting, a position that does not exist", async () => {
      const { portfolioId, assetId } = context.fixtures;
      await expect(
        context.repository.updateCurrentPrice("nonexistent-id", Money.of("1", "USD")),
      ).rejects.toThrow();
      await expect(
        context.repository.deleteByPortfolioAndAsset(portfolioId, assetId),
      ).rejects.toThrow();
    });
  });
}
