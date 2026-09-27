import { PrismaWatchlistItemRepository } from "@trading/database";
import type { WatchlistItem } from "@trading/domain";
import { getAssetById } from "./asset.service.js";
import { AppError } from "../errors/app-error.js";

const watchlistRepository = new PrismaWatchlistItemRepository();

/**
 * Returns every asset on a user's watchlist.
 * Source: FR-022/023/024 (Watchlist), 07-api-spec.md §26.
 *
 * Watchlist entries are user-scoped only (no portfolio in the path),
 * so there is no separate ownership check to perform beyond using the
 * authenticated userId directly — unlike Positions/Transactions, which
 * are nested under a portfolio owned by the caller.
 */
export function listWatchlist(userId: string): Promise<WatchlistItem[]> {
  return watchlistRepository.listByUserId(userId);
}

/**
 * Adds an asset to a user's watchlist.
 * Source: FR-022 (Add Asset to Watchlist), 07-api-spec.md §26.
 *
 * `getAssetById` throws its own 404 if the asset does not exist —
 * reused here rather than duplicated, so an invalid assetId never
 * reaches the repository at all. Duplicate prevention (05-data-model.md
 * §17) is enforced by the repository via the `@@unique([userId, assetId])`
 * constraint, surfaced as `InvalidWatchlistItemError` and mapped to 400
 * by the generic Invalid*Error handler — not re-checked here.
 */
export async function addToWatchlist(userId: string, assetId: string): Promise<WatchlistItem> {
  await getAssetById(assetId);

  return watchlistRepository.create({ userId, assetId });
}

/**
 * Removes an asset from a user's watchlist.
 * Source: FR-023 (Remove Asset From Watchlist), 07-api-spec.md §26.
 *
 * Existence is checked first via `getByUserAndAsset` so a missing entry
 * resolves to a normalized 404 instead of letting Prisma's "record to
 * delete does not exist" error (P2025) fall through to the generic 500
 * path — the same "check first, then act" shape used by
 * getPositionById/getTransactionById.
 */
export async function removeFromWatchlist(userId: string, assetId: string): Promise<void> {
  const existing = await watchlistRepository.getByUserAndAsset(userId, assetId);

  if (!existing) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  await watchlistRepository.deleteByUserAndAsset(userId, assetId);
}
