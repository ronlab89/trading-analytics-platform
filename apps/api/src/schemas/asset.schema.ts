import { z } from "zod";
import { paginationQueryShape } from "./pagination.schema.js";

/**
 * Query parameters for GET /api/v1/assets.
 * Source: 07-api-spec.md §17 (List Assets filters), FR-019/FR-020.
 */
export const listAssetsQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  assetType: z.enum(["STOCK", "ETF", "CRYPTO", "FOREX"]).optional(),
  exchange: z.string().trim().min(1).max(50).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  ...paginationQueryShape,
});
