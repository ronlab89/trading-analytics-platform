import { z } from "zod";

/**
 * Query parameters for GET /api/v1/portfolios/:portfolioId/analytics/allocation.
 * Source: 07-api-spec.md §20 (Allocation), FR-027.
 *
 * `sector` is listed in the spec but intentionally not supported yet:
 * no asset in the data model carries a sector field (it would live in
 * `metadata`, which is unseeded), so exposing it would return
 * meaningless groups.
 */
export const allocationQuerySchema = z.object({
  groupBy: z.enum(["asset", "assetType", "currency"]).default("asset"),
});

export type AllocationGroupBy = z.infer<typeof allocationQuerySchema>["groupBy"];
