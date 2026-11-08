import { z } from "zod";

/**
 * Request-boundary validation for POST /api/v1/watchlist.
 * Source: 07-api-spec.md §26 (Add Asset), FR-022.
 *
 * Only the wire shape is validated here (assetId present and non-empty);
 * "does this asset actually exist" and "is it already on the watchlist"
 * are business-rule concerns resolved in watchlist.service.ts, per
 * 09-security-spec.md §19 (transport validation must not replace
 * business-rule validation, both are required).
 */
export const addWatchlistItemRequestSchema = z.object({
  assetId: z.string().min(1, "assetId is required."),
});

export type AddWatchlistItemRequestBody = z.infer<typeof addWatchlistItemRequestSchema>;
