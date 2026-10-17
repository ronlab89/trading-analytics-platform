import { z } from "zod";
import type { Money } from "@trading/domain";
import { moneySchema, presentDate, presentMoney } from "./response-common.schema.js";

/**
 * Response shape for GET /api/v1/portfolios/:portfolioId/analytics/attribution
 * over a range.
 * Source: 07-api-spec.md §22, 16-analytics-spec.md §14.
 *
 * Contributions are money only, with no percentage, so a zero P/L needs no
 * special case. Unavailable values are `null`, never `0` (ADR-002 point 10).
 */
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const rangeAttributionResponseSchema = z.object({
  asOf: calendarDateSchema,
  effectiveFrom: calendarDateSchema.nullable(),
  status: z.enum(["OK", "INSUFFICIENT_DATA", "UNKNOWN"]),
  groupBy: z.enum(["asset", "assetType"]),
  pnl: moneySchema.nullable(),
  groups: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      contribution: moneySchema,
    }),
  ),
});
export type RangeAttributionResponse = z.infer<typeof rangeAttributionResponseSchema>;

export function presentRangeAttribution(attribution: {
  asOf: Date;
  effectiveFrom: Date | null;
  status: RangeAttributionResponse["status"];
  groupBy: RangeAttributionResponse["groupBy"];
  pnl: Money | null;
  groups: readonly { key: string; label: string; contribution: Money }[];
}): RangeAttributionResponse {
  return {
    asOf: presentDate(attribution.asOf),
    effectiveFrom:
      attribution.effectiveFrom === null ? null : presentDate(attribution.effectiveFrom),
    status: attribution.status,
    groupBy: attribution.groupBy,
    pnl: attribution.pnl === null ? null : presentMoney(attribution.pnl),
    groups: attribution.groups.map((group) => ({
      key: group.key,
      label: group.label,
      contribution: presentMoney(group.contribution),
    })),
  };
}
