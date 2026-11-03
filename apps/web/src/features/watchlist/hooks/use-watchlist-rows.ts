import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";
import { toWatchlistRow } from "../lib/watchlist-row";
import { useMarketPrices } from "./use-market-prices";
import { useWatchlist } from "./use-watchlist";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * The rows of the watchlist table: each watched asset with its symbol, name, type, exchange, price
 * and today's change. The rows wait for the assets and the prices so none flashes an unknown name
 * or a missing price; once they settle, an asset or a price that failed to load leaves null fields
 * instead of hiding the row. Only a failed watchlist request is an error.
 */
export function useWatchlistRows() {
  const watchlist = useWatchlist();
  const assetIds = useMemo(
    () => watchlist.data?.map(({ assetId }) => assetId) ?? NO_ASSET_IDS,
    [watchlist.data],
  );
  const { assets, isPending: assetsPending } = useAssets(assetIds);
  const prices = useMarketPrices(assetIds);

  const rows = useMemo(
    () =>
      watchlist.data?.map((item) =>
        toWatchlistRow(item, assets.get(item.assetId), prices.data?.get(item.assetId)),
      ),
    [watchlist.data, assets, prices.data],
  );

  const isError = watchlist.isError;
  const pricesPending = assetIds.length > 0 && prices.isPending;
  const isPending = !isError && (watchlist.isPending || assetsPending || pricesPending);

  return {
    rows: isPending || isError ? undefined : rows,
    isPending,
    isError,
    refetch: watchlist.refetch,
  };
}
