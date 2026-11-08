import { useEffect, useEffectEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAssets } from "@/hooks/use-assets";
import { AlertFormDialog } from "./alert-form-dialog";

const NO_ASSET_IDS: readonly string[] = [];

interface AssetAlertDialogProps {
  /** The asset to watch, or null while none was asked for. */
  assetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The create alert dialog for an asset the caller only knows by id, as a row of the watchlist or the
 * catalog does: the form needs its symbol and currency, so it opens once the asset is known (at
 * once when another view already loaded it). If the asset cannot be read, it says so instead of
 * leaving the click without an answer.
 */
export function AssetAlertDialog({ assetId, open, onOpenChange }: AssetAlertDialogProps) {
  const { t } = useTranslation();
  const { assets, isError } = useAssets(open && assetId !== null ? [assetId] : NO_ASSET_IDS);
  const asset = assetId === null ? undefined : assets.get(assetId);
  const failed = open && asset === undefined && isError;

  const giveUp = useEffectEvent(() => {
    toast.error(t("alerts.assetFailed"));
    onOpenChange(false);
  });
  useEffect(() => {
    if (failed) giveUp();
  }, [failed]);

  return (
    <AlertFormDialog asset={asset} onOpenChange={onOpenChange} open={open && asset !== undefined} />
  );
}
