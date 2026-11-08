import type { AlertResponse, AssetResponse } from "@trading/contracts";

export interface AlertRow {
  id: string;
  assetId: string;
  /** Null while the asset is not known: the row still shows, without a name. */
  symbol: string | null;
  name: string | null;
  /** The currency of the asset, which is the one the threshold is in. */
  currency: string | null;
  condition: string;
  threshold: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** An alert the tab lists: a price alert on one asset. The API has no other kind that fires. */
export function isAssetPriceAlert(
  alert: AlertResponse,
): alert is AlertResponse & { assetId: string } {
  return alert.type === "PRICE" && alert.assetId !== null;
}

/**
 * Joins the price alerts on an asset with that asset, newest first. Alerts of another kind are left
 * out; an asset that is not known leaves null fields instead of hiding the row.
 */
export function toAlertRows(
  alerts: readonly AlertResponse[],
  assets: ReadonlyMap<string, AssetResponse>,
): AlertRow[] {
  return alerts
    .filter(isAssetPriceAlert)
    .map((alert) => {
      const asset = assets.get(alert.assetId);
      return {
        id: alert.id,
        assetId: alert.assetId,
        symbol: asset?.symbol ?? null,
        name: asset?.name ?? null,
        currency: asset?.currency ?? null,
        condition: alert.condition,
        threshold: alert.threshold,
        enabled: alert.enabled,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
