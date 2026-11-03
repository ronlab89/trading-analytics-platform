import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CatalogRow } from "../types";

interface CatalogStarButtonProps {
  row: CatalogRow;
  onToggle: (row: CatalogRow) => void;
  /** Waits disabled while the watchlist is not known, so the star never lies about it. */
  disabled?: boolean;
}

/**
 * The star of an asset of the catalog: orange and filled when the user watches it, an outline when
 * not. Pressing it adds the asset to the watchlist or removes it. Its name says what it will do.
 */
export function CatalogStarButton({ row, onToggle, disabled = false }: CatalogStarButtonProps) {
  const { t } = useTranslation();
  const asset = row.symbol ?? row.name ?? t("markets.unknownAsset");

  return (
    <Button
      aria-label={t(row.watched ? "markets.remove" : "markets.add", { asset })}
      disabled={disabled}
      onClick={() => {
        onToggle(row);
      }}
      size="icon-sm"
      variant="ghost"
    >
      <Star
        aria-hidden="true"
        className={cn(
          row.watched
            ? "fill-(--color-brand-brand) text-(--color-brand-brand)"
            : "text-(--color-text-secondary)",
        )}
      />
    </Button>
  );
}
