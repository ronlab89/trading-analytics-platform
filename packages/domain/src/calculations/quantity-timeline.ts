import { Decimal } from "decimal.js";
import { TransactionType } from "../entities/enums";
import type { Transaction } from "../entities/transaction";
import { InsufficientPositionQuantityError } from "./position-recalculation";
import { DAY_MS, addUtcDays, startOfUtcDay } from "./utc-date";

/**
 * Daily quantity timeline.
 * Source: docs/16-analytics-spec.md §3 (ADR-004 point 1, ADR-003 points 1-3 and 6).
 *
 * `q(a, d)` counts BUY as `+quantity` and SELL as `-quantity` for every
 * transaction with `executedAt` on or before the end of `d` (UTC). It never
 * uses the stored `Position` row. Pure and deterministic (NFR-042).
 */

/** The fields of a transaction the timeline needs. The caller passes `COMPLETED` ones only. */
export type QuantityEntry = Pick<Transaction, "assetId" | "type" | "quantity" | "executedAt">;

export interface QuantityTimeline {
  /** Every UTC date from `from` to `to`, inclusive. Empty when `from` is after `to`. */
  days: Date[];
  /**
   * Quantity held at the end of each day, per asset, at the same index as
   * `days`. Holds every asset with an entry on or before `to`; a fully sold
   * asset stays at `0`.
   */
  byAsset: Map<string, number[]>;
}

/** What one asset did before the range and on each day of it. */
interface AssetChanges {
  opening: Decimal;
  perDay: Decimal[];
}

/**
 * Builds the end-of-day quantity of each asset over `[from, to]`. Entries before
 * `from` set the opening quantity; entries after `to` are ignored.
 *
 * Quantities are summed as decimals, so quantities that cancel out reach exactly
 * `0` and a fully sold asset never needs a price. Throws
 * `InsufficientPositionQuantityError` when a day ends with a negative quantity,
 * which chronological validation (ADR-003 point 6) prevents.
 */
export function buildQuantityTimeline(
  entries: readonly QuantityEntry[],
  from: Date,
  to: Date,
): QuantityTimeline {
  const firstDay = startOfUtcDay(from);
  const lastDay = startOfUtcDay(to);
  const dayCount = Math.max(0, Math.round((lastDay.getTime() - firstDay.getTime()) / DAY_MS) + 1);
  const days = Array.from({ length: dayCount }, (_, index) => addUtcDays(firstDay, index));

  const changes = new Map<string, AssetChanges>();

  for (const entry of entries) {
    const entryDay = startOfUtcDay(entry.executedAt);

    if (entryDay.getTime() > lastDay.getTime()) {
      continue;
    }

    const asset = changes.get(entry.assetId) ?? {
      opening: new Decimal(0),
      perDay: Array.from({ length: dayCount }, () => new Decimal(0)),
    };
    changes.set(entry.assetId, asset);

    const quantity = new Decimal(entry.quantity);
    const signed = entry.type === TransactionType.BUY ? quantity : quantity.negated();
    const dayIndex = Math.round((entryDay.getTime() - firstDay.getTime()) / DAY_MS);
    const day = asset.perDay[dayIndex];

    if (day === undefined) {
      asset.opening = asset.opening.plus(signed);
    } else {
      asset.perDay[dayIndex] = day.plus(signed);
    }
  }

  const byAsset = new Map<string, number[]>();

  for (const [assetId, { opening, perDay }] of changes) {
    let held = opening;

    byAsset.set(
      assetId,
      perDay.map((delta, index) => {
        held = held.plus(delta);

        if (held.isNegative()) {
          throw new InsufficientPositionQuantityError(
            `Asset ${assetId} would hold ${held.toString()} units at the end of ${days[index]?.toISOString().slice(0, 10) ?? "the range"}.`,
          );
        }

        return held.toNumber();
      }),
    );
  }

  return { days, byAsset };
}
