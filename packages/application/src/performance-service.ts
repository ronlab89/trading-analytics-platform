import type {
  Decimal,
  HistoricalPriceRepository,
  Money,
  TransactionRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { Clock } from "./clock.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";
import { buildPortfolioSeries, type SeriesTimingOptions } from "./portfolio-series.js";
import type { AnalyticsPeriod, PortfolioSeries } from "./portfolio-series.js";

/** One day of the period: its value and its return (`null` when it has none). */
export interface PerformancePoint {
  date: Date;
  value: Money | null;
  returnRate: Decimal | null;
}

export interface PerformanceResult {
  /** The effective end date: `to` clamped to the last closed UTC day. */
  asOf: Date;
  /** The first day on which every held asset has a price (§5 clamp). */
  effectiveFrom: Date | null;
  status: "OK" | "INSUFFICIENT_DATA";
  twr: Decimal | null;
  pnl: Money | null;
  series: PerformancePoint[];
}

export interface PerformanceServiceDependencies extends SeriesTimingOptions {
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  transactionRepository: Pick<TransactionRepository, "listCompletedByPortfolioId">;
  historicalPriceRepository: Pick<HistoricalPriceRepository, "listByAssetIds">;
  clock: Clock;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Portfolio performance use case.
 * Source: 07-api-spec.md §20 (Performance), 16-analytics-spec.md §5 to §8, ADR-004.
 *
 * The time-weighted return, the P/L and the daily series of the period's value
 * series (`buildPortfolioSeries`). Returns stay `Decimal` fractions: the
 * presenter converts them.
 */
export function createPerformanceService(dependencies: PerformanceServiceDependencies) {
  const { portfolioService, permissions = ROLE_PERMISSIONS } = dependencies;

  async function getPortfolioPerformance(
    actor: Actor,
    portfolioId: string,
    query: AnalyticsPeriod,
  ): Promise<PerformanceResult> {
    assertPermission(actor, "analytics:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    return buildPerformanceResult(await buildPortfolioSeries(dependencies, portfolio, query));
  }

  return { getPortfolioPerformance };
}

/**
 * Turns a portfolio series into the performance result: the measures of the
 * period and one point per day from `effectiveFrom` to `asOf`. Shared with the
 * overview, which serves the same shape for a fixed period.
 */
export function buildPerformanceResult(series: PortfolioSeries): PerformanceResult {
  const { asOf, values, performance } = series;
  const { effectiveFrom } = performance;

  if (performance.status === "INSUFFICIENT_DATA" || effectiveFrom === null) {
    return {
      asOf,
      effectiveFrom: null,
      status: performance.status,
      twr: null,
      pnl: performance.pnl,
      series: [],
    };
  }

  const rateByDay = new Map(performance.returns.map((point) => [point.date.getTime(), point.rate]));

  return {
    asOf,
    effectiveFrom,
    status: performance.status,
    twr: performance.twr,
    pnl: performance.pnl,
    series: values
      .filter((point) => point.date.getTime() >= effectiveFrom.getTime())
      .map((point) => ({
        date: point.date,
        value: point.value,
        returnRate: rateByDay.get(point.date.getTime()) ?? null,
      })),
  };
}

export type PerformanceService = ReturnType<typeof createPerformanceService>;
