import { InvalidWatchlistItemError } from "@trading/domain";
import type {
  CreateWatchlistItemInput,
  WatchlistItem,
  WatchlistItemRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `WatchlistItemRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: an asset appears once per user (a duplicate
 * raises `InvalidWatchlistItemError`, as the unique constraint does there),
 * items are listed in insertion order, and `deleteByUserAndAsset` throws when
 * the row does not exist.
 */
export class InMemoryWatchlistItemRepository implements WatchlistItemRepository {
  private readonly rows = new Map<string, WatchlistItem>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  listByUserId(userId: string): Promise<WatchlistItem[]> {
    return Promise.resolve([...this.rows.values()].filter((row) => row.userId === userId));
  }

  getByUserAndAsset(userId: string, assetId: string): Promise<WatchlistItem | null> {
    return Promise.resolve(this.find(userId, assetId) ?? null);
  }

  create(input: CreateWatchlistItemInput): Promise<WatchlistItem> {
    if (this.find(input.userId, input.assetId)) {
      return Promise.reject(
        new InvalidWatchlistItemError(
          `Asset ${input.assetId} is already on this user's watchlist.`,
        ),
      );
    }

    const item: WatchlistItem = {
      id: `watchlist_item_${String(++this.sequence)}`,
      userId: input.userId,
      assetId: input.assetId,
      createdAt: this.now(),
    };
    this.rows.set(item.id, item);

    return Promise.resolve(item);
  }

  deleteByUserAndAsset(userId: string, assetId: string): Promise<void> {
    const existing = this.find(userId, assetId);

    if (!existing) {
      return Promise.reject(
        new Error(`Asset ${assetId} is not on the watchlist of user ${userId}.`),
      );
    }

    this.rows.delete(existing.id);

    return Promise.resolve();
  }

  private find(userId: string, assetId: string): WatchlistItem | undefined {
    return [...this.rows.values()].find((row) => row.userId === userId && row.assetId === assetId);
  }
}
