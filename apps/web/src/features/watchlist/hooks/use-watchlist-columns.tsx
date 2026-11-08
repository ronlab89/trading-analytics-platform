import { useCallback } from "react";
import { AssetRowActions } from "@/features/alerts/components/asset-row-actions";
import { WatchlistRemoveButton } from "../components/watchlist-remove-button";
import type { WatchlistRow } from "../types";
import { useAssetColumns } from "./use-asset-columns";

/**
 * The columns of the watchlist table: the shared asset columns with the star that removes the
 * asset, and the bell that creates an alert for it when `onCreateAlert` is given. Both must be stable, or the columns rebuild.
 */
export function useWatchlistColumns(
  onRemove: (row: WatchlistRow) => void,
  onCreateAlert?: (assetId: string) => void,
) {
  const renderAction = useCallback(
    (row: WatchlistRow) => (
      <AssetRowActions asset={row} onCreateAlert={onCreateAlert}>
        <WatchlistRemoveButton onRemove={onRemove} row={row} />
      </AssetRowActions>
    ),
    [onRemove, onCreateAlert],
  );
  return useAssetColumns(renderAction);
}
