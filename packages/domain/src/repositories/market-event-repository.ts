import type { CreateMarketEventInput, MarketEvent } from "../entities/market-event";

/**
 * MarketEvent repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * Append-only event log: no `update()`/`delete()`, matching
 * DecisionEvent's and Transaction's historical-integrity reasoning.
 */
export interface MarketEventRepository {
  /**
   * Returns events for an asset with sequence greater than `afterSequence`
   * (or all events if omitted), ordered by sequence ascending.
   * Supports the gap-detection / resynchronization flow described in
   * 07-realtime-spec.md §25-26.
   */
  listByAssetId(assetId: string, afterSequence?: number): Promise<MarketEvent[]>;

  /** Returns the highest known sequence number for an asset, or null if none. */
  getLastSequence(assetId: string): Promise<number | null>;

  /**
   * Appends a new market event.
   * Callers are expected to have already run `validateNewMarketEvent`
   * and `isStaleMarketEvent` checks (see entities/market-event.ts)
   * before calling this — this repository does not reject stale events
   * itself, since that ordering decision belongs to the application/
   * realtime layer, not persistence.
   */
  create(input: CreateMarketEventInput): Promise<MarketEvent>;
}
