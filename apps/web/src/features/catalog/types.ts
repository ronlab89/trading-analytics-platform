import type { WatchlistRow } from "@/features/watchlist/types";

/**
 * What an asset of the catalog looks like to the table and cards that list it: the asset with its
 * current price and today's change, and whether the user already watches it. It has the fields of
 * a watchlist row, so both lists draw an asset the same way.
 */
export interface CatalogRow extends WatchlistRow {
  watched: boolean;
}
