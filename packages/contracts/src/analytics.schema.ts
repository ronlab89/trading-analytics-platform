import { z } from "zod";
import { PRESET_PERIODS } from "@trading/domain";

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

/** A `YYYY-MM-DD` query value as the UTC midnight of that date (ADR-004). */
const utcDateSchema = z.iso.date().transform((value) => new Date(value));

/**
 * Query parameters of the period-based analytics endpoints (performance and risk).
 * Source: 07-api-spec.md §20, 16-analytics-spec.md §8, ADR-002 point 10.
 *
 * A preset `period` or a custom `from` with an optional `to`, never both; with
 * neither the period is `1M`. `1D` is not a period here: it comes from
 * `MarketPrice`. An omitted `to` is today, which the service clamps to the last
 * closed day. `to` alone has no start, so it is rejected.
 */
export const analyticsPeriodQuerySchema = z
  .object({
    period: z.enum(PRESET_PERIODS).optional(),
    from: utcDateSchema.optional(),
    to: utcDateSchema.optional(),
  })
  .superRefine((query, context) => {
    if (query.period !== undefined && (query.from !== undefined || query.to !== undefined)) {
      context.addIssue({
        code: "custom",
        message: "Send either `period` or `from`/`to`, not both.",
        path: ["period"],
      });
    }

    if (query.to !== undefined && query.from === undefined) {
      context.addIssue({
        code: "custom",
        message: "`to` requires `from`.",
        path: ["to"],
      });
    }

    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      context.addIssue({
        code: "custom",
        message: "`from` must not be after `to`.",
        path: ["from"],
      });
    }
  })
  .transform((query) =>
    query.from === undefined
      ? ({ kind: "preset", period: query.period ?? "1M" } as const)
      : ({
          kind: "custom",
          from: query.from,
          ...(query.to !== undefined ? { to: query.to } : {}),
        } as const),
  );

export type AnalyticsPeriodQuery = z.infer<typeof analyticsPeriodQuerySchema>;
