import type { AssetResponse, MarketPriceResponse } from "@trading/contracts";
import type { CatalogRow } from "../types";

/**
 * Joins an asset of the catalog with its current price and whether it is on the watchlist. A price
 * that is not known leaves null fields instead of hiding the row.
 */
export function toCatalogRow(
  asset: AssetResponse,
  price: MarketPriceResponse | undefined,
  watched: boolean,
): CatalogRow {
  return {
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.assetType,
    exchange: asset.exchange,
    price: price?.price ?? null,
    changePercent: price?.changePercent ?? null,
    watched,
  };
}
