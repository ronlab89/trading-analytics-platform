import { useCallback } from "react";
import { WatchlistRemoveButton } from "../components/watchlist-remove-button";
import type { WatchlistRow } from "../types";
import { useAssetColumns } from "./use-asset-columns";

/**
 * The columns of the watchlist table: the shared asset columns with the star that removes the
 * asset. `onRemove` must be stable, or the columns rebuild.
 */
export function useWatchlistColumns(onRemove: (row: WatchlistRow) => void) {
  const renderAction = useCallback(
    (row: WatchlistRow) => <WatchlistRemoveButton onRemove={onRemove} row={row} />,
    [onRemove],
  );
  return useAssetColumns(renderAction);
}
