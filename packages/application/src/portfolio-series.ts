import {
  buildDailyFlows,
  buildQuantityTimeline,
  buildValueSeries,
  calculatePeriodPerformance,
  resolvePeriodWindow,
} from "@trading/domain";
import type {
  DailyValue,
  HistoricalPrice,
  HistoricalPriceRepository,
  PeriodPerformance,
  Portfolio,
  PresetPeriod,
  QuantityTimeline,
  Transaction,
  TransactionRepository,
} from "@trading/domain";
import type { Clock } from "./clock.js";

/**
 * The daily value series of a portfolio over one period, shared by the
 * period-based analytics (performance and risk).
 * Source: 16-analytics-spec.md §3 to §8, ADR-004.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORICAL_PRICE_EPOCH = new Date(0);

/** A preset period, or a custom range whose omitted `to` is today. */
export type AnalyticsPeriod =
  { kind: "preset"; period: PresetPeriod } | { kind: "custom"; from: Date; to?: Date };

export interface PortfolioSeriesDependencies {
  transactionRepository: Pick<TransactionRepository, "listCompletedByPortfolioId">;
  historicalPriceRepository: Pick<HistoricalPriceRepository, "listByAssetIds">;
  clock: Clock;
}

export interface PortfolioSeries {
  /** The effective end date: `to` clamped to the last closed UTC day. */
  asOf: Date;
  /** The baseline day and the days of the period, in date order. */
  values: DailyValue[];
  performance: PeriodPerformance;
  /**
   * What the series was built from, for measures that split it by asset (the range
   * attribution). `null` when no series was built: nothing to measure, or `from` after `asOf`.
   */
  inputs: SeriesInputs | null;
}

export interface SeriesInputs {
  timeline: QuantityTimeline;
  candles: HistoricalPrice[];
  transactions: Transaction[];
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Rebuilds the daily value series of `portfolio` over `query` from its
 * `COMPLETED` transactions and the historical closes, and measures the period.
 *
 * The clock is read here, once, to find the last closed UTC day (the day before
 * today): a `to` after it is clamped and reported as `asOf`, and trades after it
 * are left out. A `from` after `asOf` leaves no closed day: the performance is
 * `INSUFFICIENT_DATA`. `ALL` without a transaction is an empty portfolio.
 */
export async function buildPortfolioSeries(
  dependencies: PortfolioSeriesDependencies,
  portfolio: Pick<Portfolio, "id" | "baseCurrency">,
  query: AnalyticsPeriod,
): Promise<PortfolioSeries> {
  const { transactionRepository, historicalPriceRepository, clock } = dependencies;
  const currency = portfolio.baseCurrency;

  const lastClosedDay = addUtcDays(startOfUtcDay(clock.now()), -1);
  const requestedTo = query.kind === "custom" ? (query.to ?? lastClosedDay) : lastClosedDay;
  const asOf = requestedTo.getTime() > lastClosedDay.getTime() ? lastClosedDay : requestedTo;

  const transactions = await transactionRepository.listCompletedByPortfolioId(portfolio.id);
  const earliest = transactions[0]?.executedAt ?? null;

  const window =
    query.kind === "preset"
      ? resolvePeriodWindow(query.period, asOf, earliest)
      : { anchor: addUtcDays(startOfUtcDay(query.from), -1), from: startOfUtcDay(query.from) };

  if (window === null) {
    return {
      asOf,
      values: [],
      performance: calculatePeriodPerformance([], [], currency),
      inputs: null,
    };
  }

  if (window.from.getTime() > asOf.getTime()) {
    return {
      asOf,
      values: [],
      performance: {
        status: "INSUFFICIENT_DATA",
        effectiveFrom: null,
        twr: null,
        pnl: null,
        returns: [],
      },
      inputs: null,
    };
  }

  const timeline = buildQuantityTimeline(transactions, window.anchor, asOf);
  const candles = await historicalPriceRepository.listByAssetIds(
    [...timeline.byAsset.keys()],
    HISTORICAL_PRICE_EPOCH,
    addUtcDays(asOf, 1),
  );

  const values = buildValueSeries(timeline, candles, currency);
  // No asset to value means no value series, so there are no days to flow over either.
  const flows = values.length === 0 ? [] : buildDailyFlows(transactions, timeline.days, currency);

  return {
    asOf,
    values,
    performance: calculatePeriodPerformance(values, flows, currency),
    inputs: { timeline, candles, transactions },
  };
}
