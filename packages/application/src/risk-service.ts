import { calculateReturnDrawdown, calculateReturnVolatility } from "@trading/domain";
import type {
  HistoricalPriceRepository,
  ReturnDrawdown,
  ReturnVolatility,
  TransactionRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { Clock } from "./clock.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";
import { buildPortfolioSeries } from "./portfolio-series.js";
import type { AnalyticsPeriod } from "./portfolio-series.js";

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

/**
 * Portfolio risk use case.
 * Source: 07-api-spec.md §20 (Risk), 16-analytics-spec.md §8-§10, ADR-004.
 *
 * Measures volatility and drawdown on the daily returns of the period's value
 * series (`buildPortfolioSeries`).
 */
export function createRiskService(dependencies: RiskServiceDependencies) {
  const { portfolioService, permissions = ROLE_PERMISSIONS } = dependencies;

  async function getPortfolioRisk(
    actor: Actor,
    portfolioId: string,
    query: AnalyticsPeriod,
  ): Promise<RiskResult> {
    assertPermission(actor, "analytics:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    const { asOf, performance } = await buildPortfolioSeries(dependencies, portfolio, query);

    if (performance.status === "INSUFFICIENT_DATA") {
      return unavailable(asOf);
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

function unavailable(asOf: Date): RiskResult {
  return {
    asOf,
    effectiveFrom: null,
    status: "INSUFFICIENT_DATA",
    volatility: calculateReturnVolatility([]),
    drawdown: calculateReturnDrawdown([]),
  };
}
