import type { Asset, AssetListFilter, AssetRepository, Page, PageRequest } from "@trading/domain";
import type { Actor } from "./actor.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";

export interface AssetServiceDependencies {
  assetRepository: Pick<AssetRepository, "list" | "getById" | "getByIds">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Asset use cases.
 * Source: FR-019..FR-021, 07-api-spec.md §17.
 *
 * Assets are global reference data, not owned by a user, so only the
 * `asset:read` permission applies: there is no ownership check.
 */
export function createAssetService(dependencies: AssetServiceDependencies) {
  const { assetRepository, permissions = ROLE_PERMISSIONS } = dependencies;

  /** Lists assets (FR-019, FR-020). */
  async function listAssets(
    actor: Actor,
    filter: AssetListFilter,
    page: PageRequest,
  ): Promise<Page<Asset>> {
    assertPermission(actor, "asset:read", permissions);
    return assetRepository.list(filter, page);
  }

  /** Returns one asset, or raises `NotFoundError` if it does not exist (FR-021). */
  async function getAssetById(actor: Actor, assetId: string): Promise<Asset> {
    assertPermission(actor, "asset:read", permissions);

    const asset = await assetRepository.getById(assetId);

    if (!asset) {
      throw new NotFoundError("The requested asset could not be found.");
    }

    return asset;
  }

  /**
   * Batch lookup keyed by id, deduplicating the requested ids. Used to enrich
   * positions and transactions with symbol and name in one query instead of
   * one per row. Unknown ids are simply absent from the map.
   */
  async function getAssetsByIds(actor: Actor, ids: readonly string[]): Promise<Map<string, Asset>> {
    assertPermission(actor, "asset:read", permissions);

    const assets = await assetRepository.getByIds([...new Set(ids)]);
    return new Map(assets.map((asset) => [asset.id, asset]));
  }

  return { listAssets, getAssetById, getAssetsByIds };
}

export type AssetService = ReturnType<typeof createAssetService>;
