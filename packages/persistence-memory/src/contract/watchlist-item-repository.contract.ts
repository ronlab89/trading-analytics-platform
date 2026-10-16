import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidWatchlistItemError } from "@trading/domain";
import type { WatchlistItemRepository } from "@trading/domain";

export interface WatchlistItemContractContext {
  readonly repository: WatchlistItemRepository;
  readonly fixtures: {
    /** An existing user that owns the items created by the suite. */
    readonly userId: string;
    /** A second existing user, to check watchlists are kept per user. */
    readonly otherUserId: string;
    /** An existing asset to put on watchlists. */
    readonly assetId: string;
    /** A second existing asset. */
    readonly otherAssetId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `WatchlistItemRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Listing is only checked as a set: the storages do not promise the same
 * order. The insertion order of the in-memory implementation is checked by its
 * own tests.
 */
export function watchlistItemRepositoryContract(
  name: string,
  factory: () => Promise<WatchlistItemContractContext>,
): void {
  describe(`${name} (WatchlistItemRepository contract)`, () => {
    let context: WatchlistItemContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const assetIdsOf = async (userId: string) =>
      (await context.repository.listByUserId(userId)).map((item) => item.assetId).sort();

    it("adds an asset with an id and a creation date", async () => {
      const { userId, assetId } = context.fixtures;
      const created = await context.repository.create({ userId, assetId });
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({ userId, assetId });
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it("rejects the same asset twice for the same user, but not for another user", async () => {
      const { userId, otherUserId, assetId } = context.fixtures;
      await context.repository.create({ userId, assetId });
      await expect(context.repository.create({ userId, assetId })).rejects.toBeInstanceOf(
        InvalidWatchlistItemError,
      );
      await expect(
        context.repository.create({ userId: otherUserId, assetId }),
      ).resolves.toBeDefined();
    });

    it("finds an item by user and asset and returns null otherwise", async () => {
      const { userId, otherUserId, assetId, otherAssetId } = context.fixtures;
      const created = await context.repository.create({ userId, assetId });
      expect(await context.repository.getByUserAndAsset(userId, assetId)).toEqual(created);
      expect(await context.repository.getByUserAndAsset(userId, otherAssetId)).toBeNull();
      expect(await context.repository.getByUserAndAsset(otherUserId, assetId)).toBeNull();
    });

    it("lists only the given user's items", async () => {
      const { userId, otherUserId, assetId, otherAssetId } = context.fixtures;
      expect(await assetIdsOf(userId)).toEqual([]);
      await context.repository.create({ userId, assetId });
      await context.repository.create({ userId, assetId: otherAssetId });
      await context.repository.create({ userId: otherUserId, assetId });
      expect(await assetIdsOf(userId)).toEqual([assetId, otherAssetId].sort());
      expect(await assetIdsOf(otherUserId)).toEqual([assetId]);
    });

    it("removes an asset from the watchlist and leaves the others alone", async () => {
      const { userId, otherUserId, assetId, otherAssetId } = context.fixtures;
      await context.repository.create({ userId, assetId });
      await context.repository.create({ userId, assetId: otherAssetId });
      await context.repository.create({ userId: otherUserId, assetId });
      await context.repository.deleteByUserAndAsset(userId, assetId);
      expect(await context.repository.getByUserAndAsset(userId, assetId)).toBeNull();
      expect(await assetIdsOf(userId)).toEqual([otherAssetId]);
      expect(await assetIdsOf(otherUserId)).toEqual([assetId]);
    });

    it("throws when removing an asset that is not on the watchlist", async () => {
      const { userId, assetId } = context.fixtures;
      await expect(context.repository.deleteByUserAndAsset(userId, assetId)).rejects.toThrow();
    });
  });
}
