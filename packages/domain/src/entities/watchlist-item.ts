/**
 * WatchlistItem entity.
 * Source: docs/05-data-model.md §17
 *
 * Represents an asset monitored by a user. Duplicate prevention
 * (a user cannot watch the same asset twice) is a repository-level
 * concern, not something a single-record structural validation can
 * enforce — it requires knowledge of existing records.
 */
export interface WatchlistItem {
  readonly id: string;
  readonly userId: string;
  readonly assetId: string;
  readonly createdAt: Date;
}

export type CreateWatchlistItemInput = Pick<WatchlistItem, "userId" | "assetId">;

export class InvalidWatchlistItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWatchlistItemError";
  }
}

export function validateNewWatchlistItem(input: CreateWatchlistItemInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidWatchlistItemError("A watchlist item must belong to a user.");
  }

  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidWatchlistItemError("A watchlist item must reference an asset.");
  }
}
