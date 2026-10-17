import {
  calculateRangeAttribution,
  detectPositionEvents,
  pickTopContributors,
} from "@trading/domain";
import type { Asset, PositionEvent, SymbolContribution } from "@trading/domain";
import type { PortfolioSeries } from "./portfolio-series.js";

/**
 * What changed in a portfolio over a period.
 * Source: 07-api-spec.md §11, FR-006, ADR-010 point 1.
 *
 * Derived only from the period's value series: the largest contributor and
 * detractor of the range attribution, and the positions opened and closed.
 */
export interface WhatChanged {
  /** The effective end date: `to` clamped to the last closed UTC day. */
  asOf: Date;
  /** The first day on which every held asset has a price (§5 clamp). */
  effectiveFrom: Date | null;
  status: "OK" | "INSUFFICIENT_DATA";
  contributor: SymbolContribution | null;
  detractor: SymbolContribution | null;
  events: PositionEvent[];
}

/**
 * Builds the read model from the portfolio series of the period. `assetsById`
 * must hold every asset of the series (`series.inputs.timeline.byAsset`), so a
 * position closed before today still has its symbol.
 *
 * Without a series (nothing to measure) or without a price on `asOf` there is no
 * attribution, so there is no contributor, no detractor and no event: nothing is
 * invented in their place.
 */
export function buildWhatChanged(
  series: PortfolioSeries,
  assetsById: ReadonlyMap<string, Pick<Asset, "symbol">>,
  currency: string,
): WhatChanged {
  const { asOf, performance, inputs } = series;

  if (inputs === null) {
    return {
      asOf,
      effectiveFrom: null,
      status: performance.status,
      contributor: null,
      detractor: null,
      events: [],
    };
  }

  const attribution = calculateRangeAttribution(
    inputs.timeline,
    inputs.candles,
    inputs.transactions,
    currency,
  );
  const symbolOf = (assetId: string) => assetsById.get(assetId)?.symbol ?? assetId;
  const symbols = new Map([...inputs.timeline.byAsset.keys()].map((id) => [id, symbolOf(id)]));

  const { contributor, detractor } = pickTopContributors(
    attribution.contributions.map(({ assetId, contribution }) => ({
      assetId,
      symbol: symbolOf(assetId),
      contribution,
    })),
  );

  return {
    asOf,
    effectiveFrom: attribution.effectiveFrom,
    status: attribution.status,
    contributor,
    detractor,
    events:
      attribution.baseline === null
        ? []
        : detectPositionEvents(inputs.timeline, symbols, attribution.baseline),
  };
}
