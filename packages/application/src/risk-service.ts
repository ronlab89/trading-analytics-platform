import {
  buildDailyFlows,
  buildQuantityTimeline,
  buildValueSeries,
  calculatePeriodPerformance,
  calculateReturnDrawdown,
  calculateReturnVolatility,
  resolvePeriodWindow,
} from "@trading/domain";
import type {
  HistoricalPriceRepository,
  PresetPeriod,
  ReturnDrawdown,
  ReturnVolatility,
  TransactionRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { Clock } from "./clock.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORICAL_PRICE_EPOCH = new Date(0);

/** A preset period, or a custom range whose omitted `to` is today. */
export type RiskPeriod =
  { kind: "preset"; period: PresetPeriod } | { kind: "custom"; from: Date; to?: Date };

export interface RiskResult {
  /** The effective end date: `to` clamped to the last closed UTC day. */
  asOf: Date;
  effectiveFrom: Date | null;
  /** `INSUFFICIENT_DATA` without a price on `asOf`; `UNKNOWN` when no measure has a value. */
  status: "OK" | "INSUFFICIENT_DATA" | "UNKNOWN";
  volatility: ReturnVolatility;
  drawdown: ReturnDrawdown;
}

export interface RiskServiceDependencies {
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  transactionRepository: Pick<TransactionRepository, "listCompletedByPortfolioId">;
  historicalPriceRepository: Pick<HistoricalPriceRepository, "listByAssetIds">;
  clock: Clock;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Portfolio risk use case.
 * Source: 07-api-spec.md §20 (Risk), 16-analytics-spec.md §8-§10, ADR-004.
 *
 * Rebuilds the daily value series of the period from the `COMPLETED`
 * transactions and the historical closes, then measures volatility and drawdown
 * on its daily returns. The clock is read here, once, to find the last closed
 * UTC day (the day before today): a `to` after it is clamped and reported as
 * `asOf`, and trades after it are left out.
 */
export function createRiskService(dependencies: RiskServiceDependencies) {
  const {
    portfolioService,
    transactionRepository,
    historicalPriceRepository,
    clock,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  async function getPortfolioRisk(
    actor: Actor,
    portfolioId: string,
    query: RiskPeriod,
  ): Promise<RiskResult> {
    assertPermission(actor, "analytics:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    const lastClosedDay = addUtcDays(startOfUtcDay(clock.now()), -1);
    const requestedTo = query.kind === "custom" ? (query.to ?? lastClosedDay) : lastClosedDay;
    const asOf = requestedTo.getTime() > lastClosedDay.getTime() ? lastClosedDay : requestedTo;

    const transactions = await transactionRepository.listCompletedByPortfolioId(portfolioId);
    const earliest = transactions[0]?.executedAt ?? null;

    const window =
      query.kind === "preset"
        ? resolvePeriodWindow(query.period, asOf, earliest)
        : { anchor: addUtcDays(startOfUtcDay(query.from), -1), from: startOfUtcDay(query.from) };

    if (window === null) {
      return unavailable(asOf, "UNKNOWN");
    }

    if (window.from.getTime() > asOf.getTime()) {
      return unavailable(asOf, "INSUFFICIENT_DATA");
    }

    const timeline = buildQuantityTimeline(transactions, window.anchor, asOf);
    const candles = await historicalPriceRepository.listByAssetIds(
      [...timeline.byAsset.keys()],
      HISTORICAL_PRICE_EPOCH,
      addUtcDays(asOf, 1),
    );

    const values = buildValueSeries(timeline, candles, portfolio.baseCurrency);
    // No asset to value means no value series, so there are no days to flow over either.
    const flows =
      values.length === 0
        ? []
        : buildDailyFlows(transactions, timeline.days, portfolio.baseCurrency);
    const performance = calculatePeriodPerformance(values, flows, portfolio.baseCurrency);

    if (performance.status === "INSUFFICIENT_DATA") {
      return unavailable(asOf, "INSUFFICIENT_DATA");
    }

    const volatility = calculateReturnVolatility(
      performance.returns.flatMap((point) => (point.rate === null ? [] : [point.rate])),
    );
    const drawdown = calculateReturnDrawdown(performance.returns);

    return {
      asOf,
      effectiveFrom: performance.effectiveFrom,
      status: volatility.status === "UNKNOWN" && drawdown.status === "UNKNOWN" ? "UNKNOWN" : "OK",
      volatility,
      drawdown,
    };
  }

  return { getPortfolioRisk };
}

export type RiskService = ReturnType<typeof createRiskService>;

function unavailable(asOf: Date, status: "INSUFFICIENT_DATA" | "UNKNOWN"): RiskResult {
  return {
    asOf,
    effectiveFrom: null,
    status,
    volatility: calculateReturnVolatility([]),
    drawdown: calculateReturnDrawdown([]),
  };
}
