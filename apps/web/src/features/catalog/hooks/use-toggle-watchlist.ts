import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAddToWatchlist } from "@/features/watchlist/hooks/use-add-to-watchlist";
import { useRemoveFromWatchlist } from "@/features/watchlist/hooks/use-remove-from-watchlist";
import { useRemoveWithUndo } from "@/features/watchlist/hooks/use-remove-with-undo";
import type { CatalogRow } from "../types";

/**
 * What the star of the catalog does: adds the asset to the watchlist with the Figma toast ("<symbol> añadido a tu watchlist" and a
 * "Deshacer" that removes it), or, if it is already there,
 * removes it with the same toast and undo as the watchlist's own star. A refused addition is a
 * toast, so the user is never left guessing. The returned function is stable, so the table's
 * columns are not rebuilt.
 */
export function useToggleWatchlist() {
  const { t } = useTranslation();
  const { mutate: add } = useAddToWatchlist();
  const { mutate: remove } = useRemoveFromWatchlist();
  const removeWithUndo = useRemoveWithUndo();

  return useCallback(
    (row: CatalogRow) => {
      if (row.watched) {
        removeWithUndo(row);
        return;
      }
      const asset = row.symbol ?? row.name ?? t("markets.unknownAsset");
      add(row.assetId, {
        onSuccess: () => {
          toast(t("markets.added.title", { asset }), {
            description: t("markets.added.description"),
            action: {
              label: t("markets.added.undo"),
              onClick: () => {
                remove(row.assetId, {
                  onError: () => {
                    toast.error(t("markets.removeFailed", { asset }));
                  },
                });
              },
            },
          });
        },
        onError: () => {
          toast.error(t("markets.addFailed", { asset }));
        },
      });
    },
    [add, remove, removeWithUndo, t],
  );
}
