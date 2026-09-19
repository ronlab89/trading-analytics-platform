import { PrismaAssetRepository } from "@trading/database";
import type { Asset, AssetListFilter, Page, PageRequest } from "@trading/domain";
import { AppError } from "../errors/app-error.js";

const assetRepository = new PrismaAssetRepository();

/**
 * Batch lookup of assets keyed by id, deduplicating the requested ids.
 * Used to enrich positions/transactions with symbol and name in one
 * query instead of one per row.
 */
export async function getAssetsByIds(ids: readonly string[]): Promise<Map<string, Asset>> {
  const assets = await assetRepository.getByIds([...new Set(ids)]);
  return new Map(assets.map((asset) => [asset.id, asset]));
}

/**
 * Lists assets. Assets are global reference data (not owned by a user),
 * so no ownership check applies; authentication is enforced at the route.
 * Source: FR-019, FR-020, 07-api-spec.md §17.
 */
export function listAssets(filter: AssetListFilter, page: PageRequest): Promise<Page<Asset>> {
  return assetRepository.list(filter, page);
}

/**
 * Returns a single asset, or throws 404 if it does not exist.
 * Source: FR-021, 07-api-spec.md §17 (Get Asset).
 */
export async function getAssetById(assetId: string): Promise<Asset> {
  const asset = await assetRepository.getById(assetId);

  if (!asset) {
    throw new AppError("NOT_FOUND", "The requested asset could not be found.", 404);
  }

  return asset;
}
