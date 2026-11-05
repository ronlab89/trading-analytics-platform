import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface AssetRowActionsProps {
  /** The asset of the row, as the watchlist and the catalog know it. */
  asset: { assetId: string; symbol: string | null; name: string | null };
  /** Opens the creation of an alert for the asset. Without it the row has no bell. */
  onCreateAlert?: ((assetId: string) => void) | undefined;
  /** What the row already does to an asset: its star. */
  children: ReactNode;
}

/**
 * The actions at the end of a row of assets: a bell that creates a price alert for the asset,
 * before the row's own star. These tables have no row menu, so the bell sits beside the star.
 */
export function AssetRowActions({ asset, onCreateAlert, children }: AssetRowActionsProps) {
  const { t } = useTranslation();
  const name = asset.symbol ?? asset.name ?? t("markets.unknownAsset");

  return (
    <span className="flex items-center justify-end gap-1">
      {onCreateAlert === undefined ? null : (
        <Button
          aria-label={t("alerts.bell", { asset: name })}
          onClick={() => {
            onCreateAlert(asset.assetId);
          }}
          size="icon-sm"
          variant="ghost"
        >
          <Bell aria-hidden="true" className="text-(--color-text-secondary)" />
        </Button>
      )}
      {children}
    </span>
  );
}
