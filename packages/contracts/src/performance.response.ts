import { z } from "zod";
import type { Decimal, Money } from "@trading/domain";
import { moneySchema, presentDate, presentMoney } from "./response-common.schema.js";

/**
 * Response shape for GET /api/v1/portfolios/:portfolioId/analytics/performance.
 * Source: 07-api-spec.md §20 (Performance), 16-analytics-spec.md §5 and §7.
 *
 * Returns reach the wire here and only here: the domain keeps `Decimal`
 * fractions and this presenter converts them to unrounded percentage points
 * (ADR-004 point 14). Unavailable values are `null`, never `0` (ADR-002 point 10).
 */
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const performanceResponseSchema = z.object({
  asOf: calendarDateSchema,
  effectiveFrom: calendarDateSchema.nullable(),
  status: z.enum(["OK", "INSUFFICIENT_DATA", "UNKNOWN"]),
  twrPercent: z.number().nullable(),
  pnl: moneySchema.nullable(),
  series: z.array(
    z.object({
      date: calendarDateSchema,
      value: moneySchema.nullable(),
      returnPercent: z.number().nullable(),
    }),
  ),
});
export type PerformanceResponse = z.infer<typeof performanceResponseSchema>;

export function presentPerformance(performance: {
  asOf: Date;
  effectiveFrom: Date | null;
  status: PerformanceResponse["status"];
  twr: Decimal | null;
  pnl: Money | null;
  series: readonly { date: Date; value: Money | null; returnRate: Decimal | null }[];
}): PerformanceResponse {
  return {
    asOf: presentDate(performance.asOf),
    effectiveFrom:
      performance.effectiveFrom === null ? null : presentDate(performance.effectiveFrom),
    status: performance.status,
    twrPercent: performance.twr?.times(100).toNumber() ?? null,
    pnl: performance.pnl === null ? null : presentMoney(performance.pnl),
    series: performance.series.map((point) => ({
      date: presentDate(point.date),
      value: point.value === null ? null : presentMoney(point.value),
      returnPercent: point.returnRate?.times(100).toNumber() ?? null,
    })),
  };
}
