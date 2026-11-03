import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { WatchlistRow } from "../types";
import { useAddToWatchlist } from "./use-add-to-watchlist";
import { useRemoveFromWatchlist } from "./use-remove-from-watchlist";

/**
 * Removes an asset from the watchlist and says so in the Figma toast, "<symbol> quitado de tu
 * watchlist", with a "Deshacer" action that adds it back. A refused removal or undo is a toast
 * too, so the user is never left guessing. The returned function is stable, so the table's
 * columns are not rebuilt.
 */
export function useRemoveWithUndo() {
  const { t } = useTranslation();
  const { mutate: add } = useAddToWatchlist();
  const { mutate: remove } = useRemoveFromWatchlist();

  return useCallback(
    (row: WatchlistRow) => {
      const asset = row.symbol ?? row.name ?? t("markets.unknownAsset");
      remove(row.assetId, {
        onSuccess: () => {
          toast(t("markets.removed.title", { asset }), {
            description: t("markets.removed.description"),
            action: {
              label: t("markets.removed.undo"),
              onClick: () => {
                add(row.assetId, {
                  onError: () => {
                    toast.error(t("markets.undoFailed", { asset }));
                  },
                });
              },
            },
          });
        },
        onError: () => {
          toast.error(t("markets.removeFailed", { asset }));
        },
      });
    },
    [add, remove, t],
  );
}
