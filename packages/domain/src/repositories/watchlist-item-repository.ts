import type { CreateWatchlistItemInput, WatchlistItem } from "../entities/watchlist-item";

/**
 * WatchlistItem repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 */
export interface WatchlistItemRepository {
  /** Source: FR-022/023/024 (Watchlist). */
  listByUserId(userId: string): Promise<WatchlistItem[]>;

  /**
   * Creates a watchlist entry.
   * Duplicate prevention (05-data-model.md §17: "A user cannot have
   * duplicate entries for the same asset") is enforced here — the
   * domain entity's own comment defers this to the repository, since it
   * requires knowledge of existing records, not just the input's shape.
   * Implementations should rely on the `@@unique([userId, assetId])`
   * constraint (packages/database schema.prisma) as the authoritative
   * guard, surfacing a domain-meaningful conflict error rather than a
   * raw database error.
   */
  create(input: CreateWatchlistItemInput): Promise<WatchlistItem>;

  /** Source: FR-023 (Remove Asset From Watchlist). */
  deleteByUserAndAsset(userId: string, assetId: string): Promise<void>;
}
