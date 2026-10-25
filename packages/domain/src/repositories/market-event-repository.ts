import type { CreateMarketEventInput, MarketEvent } from "../entities/market-event.js";

/**
 * MarketEvent repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * Append-only event log: no `update()`/`delete()`, matching
 * DecisionEvent's and Transaction's historical-integrity reasoning. The only
 * removal is the bounded retention of old events (`pruneBeforeSequence`),
 * which never touches the latest event of an asset (ADR-007 point 8).
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
   *
   * `(assetId, sequence)` is unique: appending a sequence the asset already
   * has rejects and leaves the stored event untouched (ADR-007 Deferred detail).
   */
  create(input: CreateMarketEventInput): Promise<MarketEvent>;

  /**
   * Deletes the events of an asset with a sequence lower than `sequence` and
   * returns how many were deleted. The event with the highest sequence of the
   * asset is never deleted, whatever `sequence` is, so `getLastSequence` keeps
   * answering after any pruning and a restart resumes without a gap.
   */
  pruneBeforeSequence(assetId: string, sequence: number): Promise<number>;
}
