import { z } from "zod";
import type { PositionEvent, SymbolContribution } from "@trading/domain";
import { moneySchema, presentDate, presentMoney } from "./response-common.schema.js";

/**
 * The `whatChanged` field of GET /api/v1/portfolios/:portfolioId/overview.
 * Source: 07-api-spec.md §11, FR-006, ADR-010 point 1.
 *
 * Money only. A missing contributor or detractor is `null`, never a zero
 * contribution (ADR-002 point 10).
 */
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const contributionSchema = z.object({
  assetId: z.string(),
  symbol: z.string(),
  contribution: moneySchema,
});

export const whatChangedResponseSchema = z.object({
  asOf: calendarDateSchema,
  effectiveFrom: calendarDateSchema.nullable(),
  status: z.enum(["OK", "INSUFFICIENT_DATA", "UNKNOWN"]),
  contributor: contributionSchema.nullable(),
  detractor: contributionSchema.nullable(),
  events: z.array(
    z.object({
      type: z.enum(["POSITION_OPENED", "POSITION_CLOSED"]),
      date: calendarDateSchema,
      assetId: z.string(),
      symbol: z.string(),
    }),
  ),
});
export type WhatChangedResponse = z.infer<typeof whatChangedResponseSchema>;

function presentContribution(item: SymbolContribution | null) {
  return item === null
    ? null
    : {
        assetId: item.assetId,
        symbol: item.symbol,
        contribution: presentMoney(item.contribution),
      };
}

export function presentWhatChanged(whatChanged: {
  asOf: Date;
  effectiveFrom: Date | null;
  status: WhatChangedResponse["status"];
  contributor: SymbolContribution | null;
  detractor: SymbolContribution | null;
  events: readonly PositionEvent[];
}): WhatChangedResponse {
  return {
    asOf: presentDate(whatChanged.asOf),
    effectiveFrom:
      whatChanged.effectiveFrom === null ? null : presentDate(whatChanged.effectiveFrom),
    status: whatChanged.status,
    contributor: presentContribution(whatChanged.contributor),
    detractor: presentContribution(whatChanged.detractor),
    events: whatChanged.events.map((event) => ({
      type: event.type,
      date: presentDate(event.date),
      assetId: event.assetId,
      symbol: event.symbol,
    })),
  };
}
