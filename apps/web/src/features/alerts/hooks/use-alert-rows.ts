import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";
import { isAssetPriceAlert, toAlertRows } from "../lib/alert-row";
import { useAlerts } from "./use-alerts";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * The rows of the Alerts tab: each price alert with the symbol, name and currency of its asset. The
 * rows wait for the assets so none flashes an unknown name; once they settle, an asset that failed
 * to load leaves null fields instead of hiding the row. Only a failed alerts request is an error.
 */
export function useAlertRows() {
  const alerts = useAlerts();
  const assetIds = useMemo(
    () => alerts.data?.filter(isAssetPriceAlert).map(({ assetId }) => assetId) ?? NO_ASSET_IDS,
    [alerts.data],
  );
  const { assets, isPending: assetsPending } = useAssets(assetIds);

  const rows = useMemo(
    () => (alerts.data === undefined ? undefined : toAlertRows(alerts.data, assets)),
    [alerts.data, assets],
  );

  const isError = alerts.isError;
  const isPending = !isError && (alerts.isPending || assetsPending);

  return {
    rows: isPending || isError ? undefined : rows,
    isPending,
    isError,
    refetch: alerts.refetch,
  };
}
