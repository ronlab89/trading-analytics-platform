import { z } from "zod";
import type { ReturnDrawdown, ReturnVolatility } from "@trading/domain";
import { presentDate } from "./response-common.schema.js";

/**
 * Response shape for GET /api/v1/portfolios/:portfolioId/analytics/risk.
 * Source: 07-api-spec.md §20 (Risk), 16-analytics-spec.md §9 and §10.
 *
 * Unavailable values are `null`, never `0` (ADR-002 point 10). Percentages are
 * unrounded percentage points (ADR-004 point 14).
 */
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const riskResponseSchema = z.object({
  asOf: calendarDateSchema,
  effectiveFrom: calendarDateSchema.nullable(),
  status: z.enum(["OK", "INSUFFICIENT_DATA", "UNKNOWN"]),
  volatilityPercent: z.number().nullable(),
  maxDrawdownPercent: z.number().nullable(),
  currentDrawdownPercent: z.number().nullable(),
  peakDate: calendarDateSchema.nullable(),
  troughDate: calendarDateSchema.nullable(),
});
export type RiskResponse = z.infer<typeof riskResponseSchema>;

/** `status` is decided by the caller: it depends on the price of the last day, not on these values. */
export function presentRisk(risk: {
  asOf: Date;
  effectiveFrom: Date | null;
  status: RiskResponse["status"];
  volatility: ReturnVolatility;
  drawdown: ReturnDrawdown;
}): RiskResponse {
  const { volatility, drawdown } = risk;

  return {
    asOf: presentDate(risk.asOf),
    effectiveFrom: risk.effectiveFrom === null ? null : presentDate(risk.effectiveFrom),
    status: risk.status,
    volatilityPercent: volatility.volatilityPercent?.toNumber() ?? null,
    maxDrawdownPercent: drawdown.maxDrawdown?.times(100).toNumber() ?? null,
    currentDrawdownPercent: drawdown.currentDrawdown?.times(100).toNumber() ?? null,
    peakDate: drawdown.peakDate === null ? null : presentDate(drawdown.peakDate),
    troughDate: drawdown.troughDate === null ? null : presentDate(drawdown.troughDate),
  };
}
