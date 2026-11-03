import type { PaginationMeta } from "@trading/contracts";
import { useMemo, useState } from "react";
import { useMarketPrices } from "@/features/watchlist/hooks/use-market-prices";
import { useWatchlist } from "@/features/watchlist/hooks/use-watchlist";
import { toCatalogRow } from "../lib/catalog-row";
import type { CatalogFilters } from "../lib/catalog-filters";
import type { CatalogRow } from "../types";
import { useCatalogAssets, type CatalogPage } from "./use-catalog-assets";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * The rows of one page of the catalog: each asset with its current price and whether the user
 * watches it. A page is shown only once its assets, its prices and the watchlist are all in, so no
 * row flashes a missing price or the wrong star; while the next page or search loads, the rows
 * already on screen stay. Once settled, a price that failed to load leaves null fields. A failed
 * watchlist leaves the rows without stars (`canToggle` is false) instead of hiding the catalog. Only
 * a failed catalog request is an error; `meta` is the server's count for the paging.
 */
export function useCatalogRows(paging: CatalogPage, filters?: CatalogFilters, term?: string) {
  const catalog = useCatalogAssets(paging, filters, term);
  const watchlist = useWatchlist();
  const assetIds = useMemo(
    () => catalog.data?.assets.map(({ id }) => id) ?? NO_ASSET_IDS,
    [catalog.data],
  );
  const prices = useMarketPrices(assetIds);

  const rows = useMemo<readonly CatalogRow[] | undefined>(() => {
    if (catalog.data === undefined) return undefined;
    const watched = new Set(watchlist.data?.map(({ assetId }) => assetId));
    return catalog.data.assets.map((asset) =>
      toCatalogRow(asset, prices.data?.get(asset.id), watched.has(asset.id)),
    );
  }, [catalog.data, watchlist.data, prices.data]);

  const ready =
    rows !== undefined &&
    !catalog.isPlaceholderData &&
    !watchlist.isPending &&
    (assetIds.length === 0 || !prices.isPending);

  // The last page that was ready stays on screen while the next one is not (React's way to keep
  // a value across renders without a ref).
  const [shown, setShown] = useState<{
    rows: readonly CatalogRow[];
    meta: PaginationMeta;
  }>();
  if (ready && catalog.data !== undefined && shown?.rows !== rows) {
    setShown({ rows, meta: catalog.data.meta });
  }

  const isError = catalog.isError && catalog.data === undefined;

  return {
    rows: isError ? undefined : shown?.rows,
    meta: isError ? undefined : shown?.meta,
    isPending: !isError && shown === undefined,
    isError,
    canToggle: watchlist.isSuccess,
    refetch: catalog.refetch,
  };
}
