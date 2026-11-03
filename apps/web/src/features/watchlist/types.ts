import type { AssetResponse, MarketPriceResponse } from "@trading/contracts";

/**
 * What a watched asset looks like to the table and cards that list it: the asset with its current
 * price and today's change. Each field the API could not give is null, so the row still shows.
 */
export interface WatchlistRow {
  assetId: string;
  symbol: string | null;
  name: string | null;
  assetType: AssetResponse["assetType"] | null;
  exchange: string | null;
  price: MarketPriceResponse["price"] | null;
  changePercent: number | null;
}
