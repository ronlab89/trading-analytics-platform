import type { NotificationResponse } from "@trading/contracts";

/** How many notifications the panel lists; the rest are in Activity. */
export const PANEL_ROWS = 8;

/** The notifications the panel lists: the newest first, read or not, up to `limit`. */
export function toPanelRows(
  notifications: readonly NotificationResponse[],
  limit: number = PANEL_ROWS,
): NotificationResponse[] {
  return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
