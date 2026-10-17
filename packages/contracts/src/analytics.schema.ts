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
const periodFields = {
  period: z.enum(PRESET_PERIODS).optional(),
  from: utcDateSchema.optional(),
  to: utcDateSchema.optional(),
};

interface PeriodFields {
  period?: (typeof PRESET_PERIODS)[number] | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

function validatePeriodFields(query: PeriodFields, context: z.RefinementCtx): void {
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
}

function toPeriodQuery(query: PeriodFields) {
  return query.from === undefined
    ? ({ kind: "preset", period: query.period ?? "1M" } as const)
    : ({
        kind: "custom",
        from: query.from,
        ...(query.to !== undefined ? { to: query.to } : {}),
      } as const);
}

export const analyticsPeriodQuerySchema = z
  .object(periodFields)
  .superRefine(validatePeriodFields)
  .transform(toPeriodQuery);

export type AnalyticsPeriodQuery = z.infer<typeof analyticsPeriodQuerySchema>;

/**
 * Query parameters of GET /api/v1/portfolios/:portfolioId/analytics/attribution.
 * Source: 07-api-spec.md §22, 16-analytics-spec.md §14.
 *
 * Without `period`, `from`, `to` or `groupBy` the request is the current-state
 * attribution, unchanged; with any of them it is the range attribution, over the
 * period rules of `analyticsPeriodQuerySchema` and grouped by `asset` (default)
 * or `assetType`. `sector` stays deferred (ADR-004 point 13).
 */
export const attributionQuerySchema = z
  .object({ ...periodFields, groupBy: z.enum(["asset", "assetType"]).optional() })
  .superRefine(validatePeriodFields)
  .transform((query) =>
    query.period === undefined &&
    query.from === undefined &&
    query.to === undefined &&
    query.groupBy === undefined
      ? ({ kind: "current" } as const)
      : ({
          kind: "range",
          period: toPeriodQuery(query),
          groupBy: query.groupBy ?? "asset",
        } as const),
  );

export type AttributionQuery = z.infer<typeof attributionQuerySchema>;
