import type { AssetResponse } from "@trading/contracts";

export type CatalogAssetType = AssetResponse["assetType"];

/**
 * What the filters panel holds. The Figma draws checkboxes, but `listAssets` takes one `assetType`
 * and one `exchange`, so each group holds at most one value: choosing another replaces it.
 */
export interface CatalogFilters {
  assetType: CatalogAssetType | null;
  exchange: string | null;
}

/** The types of asset the filters offer, in the order of the Figma panel. */
export const CATALOG_ASSET_TYPES: readonly CatalogAssetType[] = ["STOCK", "ETF", "CRYPTO", "FOREX"];

/** The exchanges the filters offer, as the API names them; `exchangeLabel` gives their names. */
export const CATALOG_EXCHANGES: readonly string[] = ["NASDAQ", "NYSE", "NYSEARCA", "CRYPTO"];

export const NO_CATALOG_FILTERS: CatalogFilters = { assetType: null, exchange: null };

/** The filter and search part of the `listAssets` query. */
export interface CatalogQuery {
  search?: string;
  assetType?: CatalogAssetType;
  exchange?: string;
}

/** The API's own limit on the search term: a longer one is a 400, so it is cut instead. */
const MAX_TERM_LENGTH = 100;

/** What to ask the API: only what narrows the list, so no filters and no search is the plain list. */
export function toCatalogQuery(
  { assetType, exchange }: CatalogFilters,
  term: string,
): CatalogQuery {
  const search = term.trim().slice(0, MAX_TERM_LENGTH).trim();
  return {
    ...(search === "" ? {} : { search }),
    ...(assetType === null ? {} : { assetType }),
    ...(exchange === null ? {} : { exchange }),
  };
}

/** How many filters narrow the list, for "Filtros · 2". The search does not count: it has its own box. */
export function activeCatalogFilterCount({ assetType, exchange }: CatalogFilters): number {
  return (assetType === null ? 0 : 1) + (exchange === null ? 0 : 1);
}

/** Whether two sets of filters ask the API for the same assets. */
export function sameCatalogFilters(a: CatalogFilters, b: CatalogFilters): boolean {
  return a.assetType === b.assetType && a.exchange === b.exchange;
}
