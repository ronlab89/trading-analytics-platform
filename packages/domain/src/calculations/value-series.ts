import type { HistoricalPrice } from "../entities/historical-price.js";
import { Money } from "../value-objects/money.js";
import type { QuantityTimeline } from "./quantity-timeline.js";
import { startOfUtcDay } from "./utc-date.js";

/**
 * Daily portfolio value series.
 * Source: docs/16-analytics-spec.md §3 and §5 (ADR-004 points 1, 6 and 7).
 *
 *   V(d) = sum over assets of q(a, d) x c(a, d)
 *
 * Pure and deterministic (NFR-042): it never reads the clock or a repository.
 */

/** The fields of a candle the series needs. */
export type PriceCandle = Pick<HistoricalPrice, "assetId" | "timestamp" | "close">;

/** `V(d)`. `value` is `null`, never `0`, when a held asset has no price yet. */
export interface DailyValue {
  date: Date;
  value: Money | null;
  status: "OK" | "INSUFFICIENT_DATA";
}

/** An asset's candles in time order, consumed as the days advance. */
interface PriceCursor {
  candles: PriceCandle[];
  next: number;
  lastClose: Money | null;
}

/**
 * Values the portfolio on every day of `timeline`.
 *
 * `c(a, d)` is the close of the latest candle dated on or before `d` (UTC): the
 * last close carries forward over days without a candle, and a candle dated
 * after `d` is never used. A day on which a held asset has no candle yet is
 * `INSUFFICIENT_DATA` with no value; no price is extrapolated backwards. An
 * asset that is not held at the end of the day needs no price.
 *
 * `candles` must reach back before the first day for the carry-forward to work:
 * the last close before the range is what prices the first days. Returns `[]`
 * when the timeline holds no asset (no transactions). A close in another
 * currency than `currency` throws `CurrencyMismatchError`.
 */
export function buildValueSeries(
  timeline: QuantityTimeline,
  candles: readonly PriceCandle[],
  currency: string,
): DailyValue[] {
  if (timeline.byAsset.size === 0) {
    return [];
  }

  const cursors = new Map<string, PriceCursor>();

  for (const assetId of timeline.byAsset.keys()) {
    cursors.set(assetId, {
      candles: candles
        .filter((candle) => candle.assetId === assetId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      next: 0,
      lastClose: null,
    });
  }

  return timeline.days.map((date, index) => {
    let value = Money.zero(currency);
    let missingPrice = false;

    for (const [assetId, quantities] of timeline.byAsset) {
      const cursor = cursors.get(assetId);
      if (cursor === undefined) {
        continue;
      }

      // Advance even when nothing is held, so the carry-forward stays current.
      for (
        let candle = cursor.candles[cursor.next];
        candle !== undefined && startOfUtcDay(candle.timestamp).getTime() <= date.getTime();
        candle = cursor.candles[cursor.next]
      ) {
        cursor.lastClose = candle.close;
        cursor.next += 1;
      }

      const quantity = quantities[index] ?? 0;

      if (quantity === 0) {
        continue;
      }

      if (cursor.lastClose === null) {
        missingPrice = true;
        continue;
      }

      value = value.add(cursor.lastClose.multiply(quantity));
    }

    return missingPrice
      ? { date, value: null, status: "INSUFFICIENT_DATA" }
      : { date, value, status: "OK" };
  });
}
