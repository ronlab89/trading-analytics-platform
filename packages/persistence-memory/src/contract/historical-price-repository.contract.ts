import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { HistoricalPriceRepository } from "@trading/domain";

export interface HistoricalPriceContractContext {
  readonly repository: HistoricalPriceRepository;
  readonly fixtures: {
    /** An existing asset that owns the candles created by the suite. */
    readonly assetId: string;
    /** A second existing asset, to check candles are kept per asset. */
    readonly otherAssetId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

/**
 * Behavior every `HistoricalPriceRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * A candle is keyed by (asset, timestamp). Amounts have no trailing zeros, so
 * a stored amount reads back identical whatever the storage keeps for decimals.
 */
export function historicalPriceRepositoryContract(
  name: string,
  factory: () => Promise<HistoricalPriceContractContext>,
): void {
  describe(`${name} (HistoricalPriceRepository contract)`, () => {
    let context: HistoricalPriceContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const candle = (assetId: string, timestamp: Date | undefined, close = "100") => ({
      assetId,
      ...(timestamp !== undefined ? { timestamp } : {}),
      open: Money.of("99", "USD"),
      high: Money.of("101", "USD"),
      low: Money.of("98", "USD"),
      close: Money.of(close, "USD"),
      volume: 1500,
    });
    const timestampsOf = async (assetId: string, from: Date, to: Date) =>
      (await context.repository.listByAssetId(assetId, from, to)).map((c) => c.timestamp);

    it("stores a candle with the given timestamp and every field", async () => {
      const data = candle(context.fixtures.assetId, day(5));
      const stored = await context.repository.create(data);
      expect(stored).toEqual(data);
      expect(
        await context.repository.listByAssetId(context.fixtures.assetId, day(1), day(30)),
      ).toEqual([data]);
    });

    it("uses the current time when the timestamp is omitted", async () => {
      const before = Date.now();
      const stored = await context.repository.create(candle(context.fixtures.assetId, undefined));
      const after = Date.now();
      expect(stored.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(stored.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it("replays the same candle without duplicating it: the last write wins", async () => {
      await context.repository.create(candle(context.fixtures.assetId, day(5), "100"));
      const replayed = await context.repository.create(
        candle(context.fixtures.assetId, day(5), "110"),
      );
      expect(replayed.close).toEqual(Money.of("110", "USD"));
      const listed = await context.repository.listByAssetId(
        context.fixtures.assetId,
        day(1),
        day(30),
      );
      expect(listed).toEqual([replayed]);
    });

    it("keeps candles of different assets apart, even at the same timestamp", async () => {
      await context.repository.create(candle(context.fixtures.assetId, day(5), "100"));
      await context.repository.create(candle(context.fixtures.otherAssetId, day(5), "200"));
      const mine = await context.repository.listByAssetId(
        context.fixtures.assetId,
        day(1),
        day(30),
      );
      expect(mine.map((c) => c.close)).toEqual([Money.of("100", "USD")]);
    });

    it("lists one asset's candles in the inclusive range, oldest first", async () => {
      for (const n of [7, 3, 5, 20, 1]) {
        await context.repository.create(candle(context.fixtures.assetId, day(n)));
      }
      await context.repository.create(candle(context.fixtures.otherAssetId, day(5)));
      expect(await timestampsOf(context.fixtures.assetId, day(3), day(7))).toEqual([
        day(3),
        day(5),
        day(7),
      ]);
      expect(await timestampsOf(context.fixtures.otherAssetId, day(10), day(30))).toEqual([]);
    });

    it("lists the candles of several assets in the inclusive range, oldest first", async () => {
      const { assetId, otherAssetId } = context.fixtures;
      for (const n of [7, 1, 20]) {
        await context.repository.create(candle(assetId, day(n), "100"));
      }
      for (const n of [5, 3, 25]) {
        await context.repository.create(candle(otherAssetId, day(n), "200"));
      }
      const found = await context.repository.listByAssetIds(
        [assetId, otherAssetId],
        day(3),
        day(7),
      );
      expect(found.map((c) => [c.assetId, c.timestamp])).toEqual([
        [otherAssetId, day(3)],
        [otherAssetId, day(5)],
        [assetId, day(7)],
      ]);
    });

    it("lists only the requested assets and ignores one without candles", async () => {
      const { assetId, otherAssetId } = context.fixtures;
      await context.repository.create(candle(assetId, day(5)));
      await context.repository.create(candle(otherAssetId, day(5)));
      const mine = await context.repository.listByAssetIds(
        [assetId, "no-such-asset"],
        day(1),
        day(30),
      );
      expect(mine.map((c) => c.assetId)).toEqual([assetId]);
      expect(await context.repository.listByAssetIds([], day(1), day(30))).toEqual([]);
    });
  });
}
