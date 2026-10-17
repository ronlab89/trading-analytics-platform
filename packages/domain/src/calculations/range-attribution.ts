import { Money } from "../value-objects/money";
import { buildDailyFlows } from "./daily-return";
import type { FlowEntry } from "./daily-return";
import type { QuantityEntry, QuantityTimeline } from "./quantity-timeline";
import { buildValueSeries } from "./value-series";
import type { DailyValue, PriceCandle } from "./value-series";

/**
 * Attribution of a period's P/L to the assets that produced it.
 * Source: docs/16-analytics-spec.md §14.
 *
 *   contribution(a) = V_a(to) - V_a(base) - sum of F_a(d) over the days after the base
 *
 * with `F_a(d) = B_a(d) - S_a(d)`. The base is the same day the portfolio's own
 * period starts from (§5), so the contributions add up to the period P/L exactly,
 * in `Money`. Pure and deterministic (NFR-042): it never reads the clock or a
 * repository.
 */

/** The fields of a transaction the attribution needs. The caller passes `COMPLETED` ones only. */
export type AttributionEntry = QuantityEntry & FlowEntry;

export interface AssetContribution {
  assetId: string;
  contribution: Money;
}

export interface RangeAttribution {
  /** `INSUFFICIENT_DATA` when the last day has no price, as for the period P/L. */
  status: "OK" | "INSUFFICIENT_DATA";
  /** The first day of the measured period after the §5 clamp; `null` without a value. */
  effectiveFrom: Date | null;
  /**
   * The day whose close the P/L starts from: the day before `from`, or `effectiveFrom`
   * when the period is clamped. `null` without a value.
   */
  baseline: Date | null;
  /** One per asset with a transaction up to `to`, ordered by `assetId`. */
  contributions: AssetContribution[];
  /** The period P/L: the sum of the contributions. `null` only when `INSUFFICIENT_DATA`. */
  pnl: Money | null;
}

export interface GroupContribution {
  key: string;
  contribution: Money;
}

/** The index of the baseline day: the day before the trailing run of priced days. */
function baselineIndex(values: readonly DailyValue[]): number | null {
  let index = values.length;
  while (index > 0 && values[index - 1]?.status === "OK") {
    index -= 1;
  }
  return index === values.length ? null : index;
}

/** The value of a day that the portfolio's clamp has already shown to be priced. */
function pricedValue(values: readonly DailyValue[], index: number): Money {
  const value = values[index]?.value;
  if (value === null || value === undefined) {
    throw new RangeError("An asset is unpriced on a day the portfolio is priced.");
  }
  return value;
}

/**
 * Attributes the period P/L of `timeline` to each asset.
 *
 * `timeline.days[0]` is the baseline day `V(from - 1)` and the rest are the days
 * of the period up to `to`, as in `calculatePeriodPerformance`. The period is
 * clamped (§5) to the longest run of priced days that ends on `to`, and every
 * asset is measured over that same run. An empty timeline is an empty portfolio:
 * zero P/L and no contributions. A close or a trade in another currency than
 * `currency` throws `CurrencyMismatchError`.
 */
export function calculateRangeAttribution(
  timeline: QuantityTimeline,
  candles: readonly PriceCandle[],
  entries: readonly AttributionEntry[],
  currency: string,
): RangeAttribution {
  const portfolioValues = buildValueSeries(timeline, candles, currency);

  if (portfolioValues.length === 0) {
    return {
      status: "OK",
      effectiveFrom: null,
      baseline: null,
      contributions: [],
      pnl: Money.zero(currency),
    };
  }

  const baseline = baselineIndex(portfolioValues);

  if (baseline === null) {
    return {
      status: "INSUFFICIENT_DATA",
      effectiveFrom: null,
      baseline: null,
      contributions: [],
      pnl: null,
    };
  }

  const last = portfolioValues.length - 1;
  const contributions = [...timeline.byAsset]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([assetId, quantities]) => {
      const values = buildValueSeries(
        { days: timeline.days, byAsset: new Map([[assetId, quantities]]) },
        candles,
        currency,
      );
      const flows = buildDailyFlows(
        entries.filter((entry) => entry.assetId === assetId),
        timeline.days,
        currency,
      );

      let netFlow = Money.zero(currency);
      for (let index = baseline + 1; index <= last; index++) {
        const flow = flows[index];
        if (flow !== undefined) {
          netFlow = netFlow.add(flow.bought).subtract(flow.sold);
        }
      }

      return {
        assetId,
        contribution: pricedValue(values, last)
          .subtract(pricedValue(values, baseline))
          .subtract(netFlow),
      };
    });

  // Unclamped, the baseline is the day before `from`; the period starts the next day.
  const start = baseline === 0 ? Math.min(1, last) : baseline;

  return {
    status: "OK",
    effectiveFrom: portfolioValues[start]?.date ?? null,
    baseline: portfolioValues[baseline]?.date ?? null,
    contributions,
    pnl: contributions.reduce((sum, item) => sum.add(item.contribution), Money.zero(currency)),
  };
}

/**
 * Adds up the contributions that share a key (an asset type, say), ordered by key.
 * `keyOf` receives the `assetId` of each contribution.
 */
export function groupContributions(
  contributions: readonly AssetContribution[],
  keyOf: (assetId: string) => string,
): GroupContribution[] {
  const groups = new Map<string, Money>();

  for (const { assetId, contribution } of contributions) {
    const key = keyOf(assetId);
    groups.set(key, (groups.get(key) ?? Money.zero(contribution.currency)).add(contribution));
  }

  return [...groups]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, contribution]) => ({ key, contribution }));
}
