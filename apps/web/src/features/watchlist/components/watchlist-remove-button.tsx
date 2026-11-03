import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { WatchlistRow } from "../types";

/** The orange star of a watched asset; pressing it removes the asset from the watchlist. */
export function WatchlistRemoveButton({
  row,
  onRemove,
}: {
  row: WatchlistRow;
  onRemove: (row: WatchlistRow) => void;
}) {
  const { t } = useTranslation();
  const asset = row.symbol ?? row.name ?? t("markets.unknownAsset");

  return (
    <Button
      aria-label={t("markets.remove", { asset })}
      onClick={() => {
        onRemove(row);
      }}
      size="icon-sm"
      variant="ghost"
    >
      <Star aria-hidden="true" className="fill-(--color-brand-brand) text-(--color-brand-brand)" />
    </Button>
  );
}
