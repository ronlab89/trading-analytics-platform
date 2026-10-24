import { Decimal } from "decimal.js";
import type { HistoricalPrice } from "../entities/historical-price.js";
import { InsufficientDataError } from "./drawdown.js";

/**
 * Volatility calculation.
 * Source: docs/16-analytics-spec.md §9, docs/02-functional-requirements.md FR-029.
 *
 * Method: sample standard deviation (Bessel's correction, dividing by n-1) of
 * daily returns, annualized with √365 because the series is calendar-daily
 * (ADR-004). Sample (not population) deviation is used because the observed
 * returns are a sample of the behavior, the conventional choice for historical
 * volatility.
 *
 * `calculateReturnVolatility` works on any return series, so the portfolio
 * series and an asset's close-to-close returns share one rule.
 * `calculateVolatility` is the asset-level entry point (see drawdown.ts for the
 * scope limitation of the asset-level calculations).
 */

const DAYS_PER_YEAR = 365;

/** Fewer returns than this make the deviation too noisy to report (§9). */
export const MIN_VOLATILITY_RETURNS = 20;

export interface ReturnVolatility {
  readonly status: "OK" | "UNKNOWN";
  /** Annualized, in percentage points. `null`, never `0`, when `UNKNOWN`. */
  readonly volatilityPercent: Decimal | null;
  readonly sampleSize: number;
}

export interface VolatilityResult {
  readonly volatilityPercent: number;
  readonly annualized: boolean;
  readonly sampleSize: number;
}

/**
 * Annualized volatility of `returns`, the daily returns as fractions with the
 * days that have no return already left out. `UNKNOWN` under
 * `MIN_VOLATILITY_RETURNS` returns.
 */
export function calculateReturnVolatility(returns: readonly Decimal[]): ReturnVolatility {
  const sampleSize = returns.length;

  if (sampleSize < MIN_VOLATILITY_RETURNS) {
    return { status: "UNKNOWN", volatilityPercent: null, sampleSize };
  }

  const mean = Decimal.sum(...returns).dividedBy(sampleSize);
  const sumOfSquaredDeviations = Decimal.sum(...returns.map((rate) => rate.minus(mean).pow(2)));
  const dailyStandardDeviation = sumOfSquaredDeviations.dividedBy(sampleSize - 1).sqrt();

  return {
    status: "OK",
    volatilityPercent: dailyStandardDeviation.times(Decimal.sqrt(DAYS_PER_YEAR)).times(100),
    sampleSize,
  };
}

function calculateDailyReturns(sorted: readonly HistoricalPrice[]): Decimal[] {
  const returns: Decimal[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (!previous || !current) {
      continue;
    }

    const previousClose = new Decimal(previous.close.toString());
    const currentClose = new Decimal(current.close.toString());

    returns.push(currentClose.minus(previousClose).dividedBy(previousClose));
  }

  return returns;
}

/**
 * Annualized volatility of a single asset's close-to-close returns, as a
 * percentage. `prices` does not need to be pre-sorted by timestamp.
 *
 * Needs `MIN_VOLATILITY_RETURNS` returns, which is one more price point.
 * Throws `InsufficientDataError` otherwise, for the same reason as
 * `calculateDrawdown`: this is a calculation precondition, not a valid
 * empty/zero business state.
 */
export function calculateVolatility(prices: readonly HistoricalPrice[]): VolatilityResult {
  const sorted = [...prices].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const { volatilityPercent, sampleSize } = calculateReturnVolatility(
    calculateDailyReturns(sorted),
  );

  if (volatilityPercent === null) {
    throw new InsufficientDataError(
      `At least ${String(MIN_VOLATILITY_RETURNS + 1)} historical price points are required to calculate volatility.`,
    );
  }

  return { volatilityPercent: volatilityPercent.toNumber(), annualized: true, sampleSize };
}
