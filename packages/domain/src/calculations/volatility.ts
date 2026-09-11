import type { HistoricalPrice } from "../entities/historical-price";
import { InsufficientDataError } from "./drawdown";

/**
 * Volatility calculation.
 * Source: docs/06-architecture.md §10, docs/02-functional-requirements.md
 * FR-029.
 *
 * SCOPE LIMITATION: same as calculateDrawdown (see drawdown.ts) — this
 * calculates volatility for a SINGLE ASSET from its historical price
 * series, not portfolio-level volatility. Portfolio-level volatility
 * requires a reconstructed portfolio value time series from
 * Transaction[], which is future work.
 *
 * Method: sample standard deviation (Bessel's correction, dividing by
 * n-1) of daily returns, where
 * return_t = (close_t - close_t-1) / close_t-1.
 *
 * Sample (not population) standard deviation is used because the
 * observed returns are treated as a sample of the asset's return
 * behavior, not the entire population of possible returns — the
 * conventional choice for historical volatility in finance.
 *
 * `annualize` is an optional parameter: when true, the daily standard
 * deviation is scaled by √252 (approximate number of trading days in
 * a year), a standard finance convention for comparing volatility
 * across different time horizons. Defaults to false (returns daily
 * volatility) to keep the base calculation simple.
 */

const TRADING_DAYS_PER_YEAR = 252;

export interface VolatilityResult {
  readonly volatilityPercent: number;
  readonly annualized: boolean;
  readonly sampleSize: number;
}

function calculateDailyReturns(sorted: readonly HistoricalPrice[]): number[] {
  const returns: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (!previous || !current) {
      continue;
    }

    const previousClose = previous.close.toNumber();
    const currentClose = current.close.toNumber();

    returns.push((currentClose - previousClose) / previousClose);
  }

  return returns;
}

/**
 * Calculates the sample standard deviation of daily returns across a
 * historical price series, expressed as a percentage.
 *
 * `prices` does not need to be pre-sorted by timestamp.
 *
 * Requires at least 3 data points: computing daily returns needs at
 * least 2 points, and a sample standard deviation over a single
 * return (n=1) is undefined (division by n-1=0). Throws
 * `InsufficientDataError` otherwise, for the same reason as
 * `calculateDrawdown` — this is a calculation precondition, not a
 * valid empty/zero business state.
 */
export function calculateVolatility(
  prices: readonly HistoricalPrice[],
  options: { annualize?: boolean } = {},
): VolatilityResult {
  if (prices.length < 3) {
    throw new InsufficientDataError(
      "At least 3 historical price points are required to calculate volatility.",
    );
  }

  const sorted = [...prices].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const returns = calculateDailyReturns(sorted);
  const sampleSize = returns.length;

  const mean = returns.reduce((sum, value) => sum + value, 0) / sampleSize;

  const sumOfSquaredDeviations = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0);

  const sampleVariance = sumOfSquaredDeviations / (sampleSize - 1);
  const dailyStandardDeviation = Math.sqrt(sampleVariance);

  const annualize = options.annualize ?? false;
  const standardDeviation = annualize
    ? dailyStandardDeviation * Math.sqrt(TRADING_DAYS_PER_YEAR)
    : dailyStandardDeviation;

  return {
    volatilityPercent: standardDeviation * 100,
    annualized: annualize,
    sampleSize,
  };
}
