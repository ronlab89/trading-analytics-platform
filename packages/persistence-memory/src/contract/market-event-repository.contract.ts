import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { MarketEventRepository } from "@trading/domain";

export interface MarketEventContractContext {
  readonly repository: MarketEventRepository;
  readonly fixtures: {
    /** An existing asset that owns the events created by the suite. */
    readonly assetId: string;
    /** A second existing asset, to check events are scoped by asset. */
    readonly otherAssetId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `MarketEventRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * (asset, sequence) is unique, and pruning never removes an asset's newest event.
 */
export function marketEventRepositoryContract(
  name: string,
  factory: () => Promise<MarketEventContractContext>,
): void {
  describe(`${name} (MarketEventRepository contract)`, () => {
    let context: MarketEventContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (sequence: number, assetId = context.fixtures.assetId) => ({
      assetId,
      price: Money.of("184.22", "USD"),
      sequence,
    });
    const createAll = async (sequences: readonly number[], assetId = context.fixtures.assetId) => {
      for (const sequence of sequences) {
        await context.repository.create(input(sequence, assetId));
      }
    };
    const sequencesOf = async (assetId: string, afterSequence?: number) =>
      (await context.repository.listByAssetId(assetId, afterSequence)).map((e) => e.sequence);

    it("creates an event with an id, its price and a numeric sequence", async () => {
      const created = await context.repository.create(input(1));
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({ assetId: context.fixtures.assetId, price: input(1).price });
      expect(created.sequence).toBe(1);
      expect(typeof created.sequence).toBe("number");
      expect(created.timestamp).toBeInstanceOf(Date);
    });

    it("lists one asset's events ordered by sequence, whatever the insertion order", async () => {
      await createAll([3, 1, 2]);
      await createAll([9], context.fixtures.otherAssetId);
      expect(await sequencesOf(context.fixtures.assetId)).toEqual([1, 2, 3]);
      expect(await sequencesOf("nonexistent-id")).toEqual([]);
    });

    it("orders sequences numerically, not as text", async () => {
      await createAll([10, 9, 100, 2]);
      expect(await sequencesOf(context.fixtures.assetId)).toEqual([2, 9, 10, 100]);
    });

    it("returns only the events after the given sequence, excluding it", async () => {
      await createAll([1, 2, 3, 4]);
      expect(await sequencesOf(context.fixtures.assetId, 2)).toEqual([3, 4]);
      expect(await sequencesOf(context.fixtures.assetId, 0)).toEqual([1, 2, 3, 4]);
    });

    it("returns the highest sequence of an asset, or null when it has no events", async () => {
      await createAll([5, 12, 7]);
      await createAll([99], context.fixtures.otherAssetId);
      expect(await context.repository.getLastSequence(context.fixtures.assetId)).toBe(12);
      expect(await context.repository.getLastSequence("nonexistent-id")).toBeNull();
    });

    it("rejects a second event with the same asset and sequence and keeps the first", async () => {
      await createAll([1, 2]);
      await expect(context.repository.create(input(2))).rejects.toThrow();
      expect(await sequencesOf(context.fixtures.assetId)).toEqual([1, 2]);
    });

    it("accepts the same sequence for another asset", async () => {
      await createAll([1]);
      await createAll([1], context.fixtures.otherAssetId);
      expect(await sequencesOf(context.fixtures.otherAssetId)).toEqual([1]);
    });

    it("prunes the events below a sequence and returns how many it deleted", async () => {
      await createAll([1, 2, 3, 4, 5]);
      await createAll([1, 2], context.fixtures.otherAssetId);
      expect(await context.repository.pruneBeforeSequence(context.fixtures.assetId, 4)).toBe(3);
      expect(await sequencesOf(context.fixtures.assetId)).toEqual([4, 5]);
      expect(await sequencesOf(context.fixtures.otherAssetId)).toEqual([1, 2]);
    });

    it("never prunes the newest event, so the last sequence survives", async () => {
      await createAll([1, 2, 3]);
      expect(await context.repository.pruneBeforeSequence(context.fixtures.assetId, 100)).toBe(2);
      expect(await sequencesOf(context.fixtures.assetId)).toEqual([3]);
      expect(await context.repository.getLastSequence(context.fixtures.assetId)).toBe(3);
    });

    it("prunes nothing when no event is below the sequence or the asset has none", async () => {
      await createAll([5, 6]);
      expect(await context.repository.pruneBeforeSequence(context.fixtures.assetId, 5)).toBe(0);
      expect(await context.repository.pruneBeforeSequence("nonexistent-id", 5)).toBe(0);
      expect(await sequencesOf(context.fixtures.assetId)).toEqual([5, 6]);
    });
  });
}
