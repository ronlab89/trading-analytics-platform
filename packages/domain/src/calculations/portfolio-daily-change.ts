import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import type { MarketPrice } from "../entities/market-price";
import { Money } from "../value-objects/money";
import { InsufficientDataError } from "./drawdown";

/**
 * Portfolio-level daily change calculation.
 * Source: docs/05-data-model.md §24 (dailyChange/dailyChangePercent —
 * listed there as a field `calculatePortfolioMetrics` explicitly leaves
 * out, "requires a historical snapshot"). `MarketPrice` (§18) is that
 * snapshot: it already carries `previousPrice`/`change`/`changePercent`
 * per asset, so this function combines it with held quantities to get
 * a value-weighted portfolio-level figure — summing per-asset
 * `changePercent` values directly would be wrong (a 10% move on a tiny
 * position must not count as much as a 10% move on the largest one).
 *
 * Deliberately takes `MarketPrice` per asset (not `HistoricalPrice`):
 * daily change is about "since the last known tick", which is exactly
 * what MarketPrice.previousPrice/change represent — not a lookup into
 * yesterday's OHLCV candle (a related but distinct concept, already
 * used separately by calculateDrawdown/calculateVolatility).
 */

export interface PortfolioDailyChange {
  readonly changeValue: Money;
  readonly changePercent: number;
  /**
   * Ids of held assets excluded from this calculation because no
   * current MarketPrice was available for them. Present so callers
   * (and ultimately API consumers) can tell "fully computed" apart
   * from "computed over a subset" instead of silently guessing.
   */
  readonly excludedAssetIds: readonly string[];
}

/**
 * Calculates the portfolio's total value change since the last known
 * market tick, weighted by each position's held quantity.
 *
 * An empty position list is a valid empty-portfolio state (FR-058) and
 * returns a zeroed result. This is different from "positions exist but
 * none have current price data", which throws `InsufficientDataError`
 * — that is a data-availability problem, not a valid empty state (same
 * distinction `calculateDrawdown`/`calculateVolatility` make).
 *
 * Positions whose asset has no entry in `currentPricesByAssetId` are
 * skipped and reported in `excludedAssetIds`, rather than causing the
 * whole calculation to fail — a dashboard should still show a partial,
 * honest figure for the assets it does have data for.
 *
 * Money arithmetic requires every `MarketPrice.change`/`previousPrice`
 * value to share `portfolio.baseCurrency`; a mismatch propagates as
 * `CurrencyMismatchError`, consistent with every other multi-position
 * aggregation in this module (see allocation.ts, portfolio-metrics.ts).
 */
export function calculatePortfolioDailyChange(
  portfolio: Portfolio,
  positions: readonly Position[],
  currentPricesByAssetId: ReadonlyMap<string, MarketPrice>,
): PortfolioDailyChange {
  const currency = portfolio.baseCurrency;

  if (positions.length === 0) {
    return { changeValue: Money.zero(currency), changePercent: 0, excludedAssetIds: [] };
  }

  let changeValue = Money.zero(currency);
  let previousValue = Money.zero(currency);
  const excludedAssetIds: string[] = [];

  for (const position of positions) {
    const marketPrice = currentPricesByAssetId.get(position.assetId);

    if (!marketPrice) {
      excludedAssetIds.push(position.assetId);
      continue;
    }

    changeValue = changeValue.add(marketPrice.change.multiply(position.quantity));
    previousValue = previousValue.add(marketPrice.previousPrice.multiply(position.quantity));
  }

  if (excludedAssetIds.length === positions.length) {
    throw new InsufficientDataError(
      "No current market price data is available for any held position.",
    );
  }

  const changePercent = previousValue.isZero()
    ? 0
    : (changeValue.toNumber() / previousValue.toNumber()) * 100;

  return { changeValue, changePercent, excludedAssetIds };
}
