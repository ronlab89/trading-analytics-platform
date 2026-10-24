import type { CreateHistoricalPriceInput, HistoricalPrice } from "../entities/historical-price";

/**
 * HistoricalPrice repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * Identified by (assetId, timestamp), not a generated id — mirrors the
 * composite primary key in schema.prisma and the domain entity itself,
 * which has no `id` field (05-data-model.md §20).
 */
export interface HistoricalPriceRepository {
  /**
   * Returns OHLCV candles for an asset within a time range, ordered by
   * timestamp ascending. Source: FR-026 (Historical Performance),
   * 07-api-spec.md §18 (GET /assets/:assetId/history).
   */
  listByAssetId(assetId: string, from: Date, to: Date): Promise<HistoricalPrice[]>;

  /**
   * Returns the candles of several assets within an inclusive time range, in
   * one read, ordered by timestamp ascending. Candles that share a timestamp
   * are in no guaranteed order. An asset without candles contributes none, and
   * an empty `assetIds` returns `[]`. The input of the portfolio value series
   * (docs/16-analytics-spec.md §3).
   */
  listByAssetIds(assetIds: readonly string[], from: Date, to: Date): Promise<HistoricalPrice[]>;

  /**
   * Returns the candle with the latest timestamp of an asset, or null when it
   * has none. The market simulator reads it at startup to know which days the
   * server was offline (ADR-007 point 8).
   */
  getLatestByAssetId(assetId: string): Promise<HistoricalPrice | null>;

  /**
   * Creates a historical price candle.
   * Callers are expected to have already run `validateNewHistoricalPrice`
   * (see entities/historical-price.ts) before calling this. Implementations
   * should treat (assetId, timestamp) as an idempotent key — replaying the
   * same candle should not create a duplicate row.
   */
  create(input: CreateHistoricalPriceInput): Promise<HistoricalPrice>;
}
