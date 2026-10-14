import type { WatchlistItem, WatchlistItemRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import type { AssetService } from "./asset-service.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";

export interface WatchlistServiceDependencies {
  watchlistRepository: Pick<
    WatchlistItemRepository,
    "listByUserId" | "getByUserAndAsset" | "create" | "deleteByUserAndAsset"
  >;
  assetService: Pick<AssetService, "getAssetById">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Watchlist use cases.
 * Source: FR-022..FR-024, 07-api-spec.md §26.
 *
 * Watchlist entries are user-scoped only (no portfolio in the path), so
 * scoping by `actor.userId` is the whole ownership check.
 */
export function createWatchlistService(dependencies: WatchlistServiceDependencies) {
  const { watchlistRepository, assetService, permissions = ROLE_PERMISSIONS } = dependencies;

  /** Returns every asset on the actor's watchlist. */
  async function listWatchlist(actor: Actor): Promise<WatchlistItem[]> {
    assertPermission(actor, "watchlist:read", permissions);

    return watchlistRepository.listByUserId(actor.userId);
  }

  /**
   * Adds an asset to the actor's watchlist (FR-022).
   *
   * The asset lookup raises its own not-found, so an invalid assetId never
   * reaches the repository. Duplicate prevention (05-data-model.md §17) is
   * enforced by the repository through the `@@unique([userId, assetId])`
   * constraint, surfaced as `InvalidWatchlistItemError` and mapped to 400
   * by the generic Invalid*Error handler: not re-checked here.
   */
  async function addToWatchlist(actor: Actor, assetId: string): Promise<WatchlistItem> {
    assertPermission(actor, "watchlist:write", permissions);
    await assetService.getAssetById(actor, assetId);

    return watchlistRepository.create({ userId: actor.userId, assetId });
  }

  /**
   * Removes an asset from the actor's watchlist (FR-023).
   *
   * Existence is checked first so a missing entry is a not-found instead
   * of letting Prisma's "record to delete does not exist" error (P2025)
   * fall through to a generic 500.
   */
  async function removeFromWatchlist(actor: Actor, assetId: string): Promise<void> {
    assertPermission(actor, "watchlist:write", permissions);

    const existing = await watchlistRepository.getByUserAndAsset(actor.userId, assetId);

    if (!existing) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    await watchlistRepository.deleteByUserAndAsset(actor.userId, assetId);
  }

  return { listWatchlist, addToWatchlist, removeFromWatchlist };
}

export type WatchlistService = ReturnType<typeof createWatchlistService>;
