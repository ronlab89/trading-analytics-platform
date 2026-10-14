import type { Asset } from "@trading/domain";
import { composition } from "../composition.js";
import { transitionalActor } from "./transitional-actor.js";

/**
 * Transitional adapter for the services that have not moved to
 * `@trading/application` yet (alerts, watchlist, analytics, overview,
 * scenarios). Deleted with the last of them (B0.5 T6).
 */
export function getAssetById(assetId: string): Promise<Asset> {
  return composition.assetService.getAssetById(transitionalActor(), assetId);
}

export function getAssetsByIds(ids: readonly string[]): Promise<Map<string, Asset>> {
  return composition.assetService.getAssetsByIds(transitionalActor(), ids);
}
