import type { AssetResponse, MarketPriceResponse, WatchlistItemResponse } from "@trading/contracts";
import type { WatchlistRow } from "../types";

/**
 * Joins a watchlist entry with its asset and its current price. An asset or a price that is not
 * known leaves null fields instead of hiding the row.
 */
export function toWatchlistRow(
  item: WatchlistItemResponse,
  asset: AssetResponse | undefined,
  price: MarketPriceResponse | undefined,
): WatchlistRow {
  return {
    assetId: item.assetId,
    symbol: asset?.symbol ?? null,
    name: asset?.name ?? null,
    assetType: asset?.assetType ?? null,
    exchange: asset?.exchange ?? null,
    price: price?.price ?? null,
    changePercent: price?.changePercent ?? null,
  };
}
