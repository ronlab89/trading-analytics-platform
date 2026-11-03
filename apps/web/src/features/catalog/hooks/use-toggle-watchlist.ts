import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAddToWatchlist } from "@/features/watchlist/hooks/use-add-to-watchlist";
import { useRemoveWithUndo } from "@/features/watchlist/hooks/use-remove-with-undo";
import type { CatalogRow } from "../types";

/**
 * What the star of the catalog does: adds the asset to the watchlist, or, if it is already there,
 * removes it with the same toast and undo as the watchlist's own star. A refused addition is a
 * toast, so the user is never left guessing. The returned function is stable, so the table's
 * columns are not rebuilt.
 */
export function useToggleWatchlist() {
  const { t } = useTranslation();
  const { mutate: add } = useAddToWatchlist();
  const removeWithUndo = useRemoveWithUndo();

  return useCallback(
    (row: CatalogRow) => {
      if (row.watched) {
        removeWithUndo(row);
        return;
      }
      add(row.assetId, {
        onError: () => {
          toast.error(
            t("markets.addFailed", { asset: row.symbol ?? row.name ?? t("markets.unknownAsset") }),
          );
        },
      });
    },
    [add, removeWithUndo, t],
  );
}
