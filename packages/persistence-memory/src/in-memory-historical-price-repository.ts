import type {
  CreateHistoricalPriceInput,
  HistoricalPrice,
  HistoricalPriceRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `HistoricalPriceRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: a candle is keyed by (assetId, timestamp), so
 * `create` replaying the same candle overwrites it instead of duplicating
 * it; the timestamp defaults to "now"; the range is inclusive and the
 * result is ordered oldest first.
 */
export class InMemoryHistoricalPriceRepository implements HistoricalPriceRepository {
  private readonly rows = new Map<string, HistoricalPrice>();
  private readonly now: () => Date;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  listByAssetId(assetId: string, from: Date, to: Date): Promise<HistoricalPrice[]> {
    const found = [...this.rows.values()]
      .filter(
        (row) =>
          row.assetId === assetId &&
          row.timestamp.getTime() >= from.getTime() &&
          row.timestamp.getTime() <= to.getTime(),
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return Promise.resolve(found);
  }

  listByAssetIds(assetIds: readonly string[], from: Date, to: Date): Promise<HistoricalPrice[]> {
    const wanted = new Set(assetIds);
    const found = [...this.rows.values()]
      .filter(
        (row) =>
          wanted.has(row.assetId) &&
          row.timestamp.getTime() >= from.getTime() &&
          row.timestamp.getTime() <= to.getTime(),
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return Promise.resolve(found);
  }

  create(input: CreateHistoricalPriceInput): Promise<HistoricalPrice> {
    const candle: HistoricalPrice = { ...input, timestamp: input.timestamp ?? this.now() };
    this.rows.set(`${candle.assetId}|${String(candle.timestamp.getTime())}`, candle);

    return Promise.resolve(candle);
  }
}
