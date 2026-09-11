import type { HistoricalPrice } from "../entities/historical-price";

/**
 * Drawdown calculation.
 * Source: docs/06-architecture.md §10, docs/02-functional-requirements.md
 * FR-028.
 *
 * SCOPE LIMITATION: this calculates maximum drawdown for a SINGLE
 * ASSET from its historical price series (HistoricalPrice[]) — it does
 * NOT calculate portfolio-level drawdown.
 *
 * True portfolio-level drawdown would require a time series of the
 * portfolio's total value day by day, which in turn requires
 * reconstructing historical position composition from Transaction[]
 * (execution dates, quantities, prices at each point in time). That
 * input does not exist yet in any domain calculation — it is future
 * work once a transaction-aware time series calculation is built.
 *
 * This function remains useful on its own for asset-level analysis
 * (FR-021, Asset Detail) even though it is not yet wired into
 * Portfolio Pulse or portfolio-level analytics.
 */

export class InsufficientDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientDataError";
  }
}

export interface DrawdownResult {
  readonly maxDrawdownPercent: number;
  readonly peakTimestamp: Date;
  readonly troughTimestamp: Date;
}

/**
 * Calculates the maximum drawdown (largest peak-to-trough decline,
 * as a negative percentage) across a historical price series, using
 * each observation's closing price.
 *
 * `prices` does not need to be pre-sorted by timestamp — this function
 * sorts a local copy internally, so callers are not required to
 * guarantee ordering themselves.
 *
 * Requires at least 2 data points; a single price has no drawdown to
 * measure. Throws `InsufficientDataError` otherwise, since this is a
 * calculation precondition, not a valid empty/zero business state
 * (unlike an empty portfolio, which has no such precondition problem).
 */
export function calculateDrawdown(prices: readonly HistoricalPrice[]): DrawdownResult {
  if (prices.length < 2) {
    throw new InsufficientDataError(
      "At least 2 historical price points are required to calculate drawdown.",
    );
  }

  const sorted = [...prices].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const first = sorted[0];
  if (!first) {
    throw new InsufficientDataError(
      "At least 2 historical price points are required to calculate drawdown.",
    );
  }

  let peakValue = first.close.toNumber();
  let peakTimestamp = first.timestamp;

  let maxDrawdownPercent = 0;
  let worstPeakTimestamp = first.timestamp;
  let worstTroughTimestamp = first.timestamp;

  for (const point of sorted) {
    const currentValue = point.close.toNumber();

    if (currentValue > peakValue) {
      peakValue = currentValue;
      peakTimestamp = point.timestamp;
      continue;
    }

    const drawdownPercent = ((currentValue - peakValue) / peakValue) * 100;

    if (drawdownPercent < maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPercent;
      worstPeakTimestamp = peakTimestamp;
      worstTroughTimestamp = point.timestamp;
    }
  }

  return {
    maxDrawdownPercent,
    peakTimestamp: worstPeakTimestamp,
    troughTimestamp: worstTroughTimestamp,
  };
}
