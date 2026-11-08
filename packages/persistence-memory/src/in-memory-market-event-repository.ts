import type { CreateMarketEventInput, MarketEvent, MarketEventRepository } from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `MarketEventRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: events are immutable, the timestamp is the
 * creation time, an asset's events are listed by `sequence` ascending
 * (optionally only those after a given sequence, exclusive), and a second event
 * with the same (asset, sequence) rejects, as the unique index does.
 */
export class InMemoryMarketEventRepository implements MarketEventRepository {
  private readonly rows: MarketEvent[] = [];
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  listByAssetId(assetId: string, afterSequence?: number): Promise<MarketEvent[]> {
    const found = this.rows
      .filter(
        (event) =>
          event.assetId === assetId &&
          (afterSequence === undefined || event.sequence > afterSequence),
      )
      .sort((a, b) => a.sequence - b.sequence);

    return Promise.resolve(found);
  }

  getLastSequence(assetId: string): Promise<number | null> {
    const sequences = this.rows.filter((e) => e.assetId === assetId).map((e) => e.sequence);

    return Promise.resolve(sequences.length > 0 ? Math.max(...sequences) : null);
  }

  create(input: CreateMarketEventInput): Promise<MarketEvent> {
    if (this.rows.some((e) => e.assetId === input.assetId && e.sequence === input.sequence)) {
      return Promise.reject(
        new Error(
          `Market event ${input.assetId} #${String(input.sequence)} already exists (unique asset and sequence).`,
        ),
      );
    }
    const event: MarketEvent = {
      id: `market_event_${String(++this.sequence)}`,
      assetId: input.assetId,
      price: input.price,
      timestamp: this.now(),
      sequence: input.sequence,
    };
    this.rows.push(event);

    return Promise.resolve(event);
  }

  pruneBeforeSequence(assetId: string, sequence: number): Promise<number> {
    const sequences = this.rows.filter((e) => e.assetId === assetId).map((e) => e.sequence);
    if (sequences.length === 0) {
      return Promise.resolve(0);
    }
    // The newest event stays, so the next sequence of the asset can always be found.
    const latest = Math.max(...sequences);
    const doomed = this.rows.filter(
      (e) => e.assetId === assetId && e.sequence < sequence && e.sequence !== latest,
    );
    for (const event of doomed) {
      this.rows.splice(this.rows.indexOf(event), 1);
    }

    return Promise.resolve(doomed.length);
  }
}
