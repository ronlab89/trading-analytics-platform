import type { WatchlistItem as PrismaWatchlistItem } from "../../generated/client/index.js";
import type { WatchlistItem } from "@trading/domain";

export function toDomainWatchlistItem(row: PrismaWatchlistItem): WatchlistItem {
  return {
    id: row.id,
    userId: row.userId,
    assetId: row.assetId,
    createdAt: row.createdAt,
  };
}
