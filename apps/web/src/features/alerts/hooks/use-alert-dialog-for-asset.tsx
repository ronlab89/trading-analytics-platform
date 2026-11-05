import { useCallback, useState } from "react";
import { AssetAlertDialog } from "../components/asset-alert-dialog";

/**
 * What a view needs to offer "Create alert" on its assets: `openFor` (stable) to call with the id
 * of the asset, and the `dialog` to render once, anywhere in the view. The asset is kept after the
 * dialog closes, so it does not go blank while it fades out.
 */
export function useAlertDialogForAsset() {
  const [state, setState] = useState<{ open: boolean; assetId: string | null }>({
    open: false,
    assetId: null,
  });

  const openFor = useCallback((assetId: string) => {
    setState({ open: true, assetId });
  }, []);

  const dialog = (
    <AssetAlertDialog
      assetId={state.assetId}
      onOpenChange={(open) => {
        setState((current) => ({ ...current, open }));
      }}
      open={state.open}
    />
  );

  return { openFor, dialog };
}
