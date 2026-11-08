import type { QuantityTimeline } from "./quantity-timeline.js";

/**
 * Positions opened and closed over a period.
 * Source: docs/02-functional-requirements.md FR-006, ADR-010 point 1.
 *
 * Pure and deterministic (NFR-042): it never reads the clock or a repository.
 */

export type PositionEventType = "POSITION_OPENED" | "POSITION_CLOSED";

export interface PositionEvent {
  type: PositionEventType;
  date: Date;
  assetId: string;
  symbol: string;
}

/**
 * Finds the positions opened (the quantity at the end of the day goes from `0` to
 * above `0`) and closed (it goes from above `0` to `0`) on the days after
 * `baseline`.
 *
 * `baseline` is the day the period starts from (`V(from - 1)`, or `effectiveFrom`
 * when the period is clamped), so what was already held on it is not an opening.
 * The quantity is measured at the end of each day: a purchase and a full sale on
 * the same day leave no event. A position that opens and closes inside the period
 * produces both, in date order. The events are ordered by date and then by symbol;
 * an asset without a symbol in `symbols` is reported by its id. Returns `[]` when
 * `baseline` is not a day of `timeline`.
 */
export function detectPositionEvents(
  timeline: QuantityTimeline,
  symbols: ReadonlyMap<string, string>,
  baseline: Date,
): PositionEvent[] {
  const baselineIndex = timeline.days.findIndex((date) => date.getTime() === baseline.getTime());

  if (baselineIndex < 0) {
    return [];
  }

  const events: PositionEvent[] = [];

  for (const [assetId, quantities] of timeline.byAsset) {
    for (let index = baselineIndex + 1; index < timeline.days.length; index++) {
      const wasHeld = (quantities[index - 1] ?? 0) > 0;
      const isHeld = (quantities[index] ?? 0) > 0;
      const date = timeline.days[index];

      if (date === undefined || wasHeld === isHeld) {
        continue;
      }

      events.push({
        type: isHeld ? "POSITION_OPENED" : "POSITION_CLOSED",
        date,
        assetId,
        symbol: symbols.get(assetId) ?? assetId,
      });
    }
  }

  return events.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0),
  );
}
