import { z } from "zod";
import type { WatchlistItem } from "@trading/domain";
import { isoTimestampSchema, presentTimestamp } from "./response-common.schema.js";

/**
 * Response shape for the watchlist endpoints.
 * Source: 07-api-spec.md §26, FR-022/023/024.
 */
export const watchlistItemResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  assetId: z.string(),
  createdAt: isoTimestampSchema,
});
export type WatchlistItemResponse = z.infer<typeof watchlistItemResponseSchema>;

export function presentWatchlistItem(item: WatchlistItem): WatchlistItemResponse {
  return {
    id: item.id,
    userId: item.userId,
    assetId: item.assetId,
    createdAt: presentTimestamp(item.createdAt),
  };
}
