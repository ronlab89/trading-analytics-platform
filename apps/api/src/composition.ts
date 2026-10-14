import {
  PrismaAssetRepository,
  PrismaDecisionEventRepository,
  PrismaDecisionRepository,
  PrismaHistoricalPriceRepository,
  PrismaMarketPriceRepository,
  PrismaPortfolioRepository,
  PrismaPositionRepository,
  PrismaScenarioRepository,
  PrismaTransactionRepository,
  PrismaUnitOfWork,
} from "@trading/database";
import {
  createAnalyticsService,
  createAssetService,
  createDecisionService,
  createMarketService,
  createOverviewService,
  createPortfolioService,
  createPositionService,
  createScenarioService,
  createTransactionService,
} from "@trading/application";
import type { Clock } from "@trading/application";

/**
 * Composition root: the one place that builds concrete dependencies and
 * hands them to the use cases.
 * Source: ADR-001 point 4, 06-architecture.md §11.
 *
 * The system clock lives here, and only here, so application and domain
 * code never call `new Date()` (ADR-001 point 8). Each resource moved to
 * `@trading/application` adds its repositories and use cases below.
 */
export const systemClock: Clock = { now: () => new Date() };

export function buildComposition(clock: Clock) {
  const assetRepository = new PrismaAssetRepository();

  const portfolioService = createPortfolioService({
    portfolioRepository: new PrismaPortfolioRepository(),
  });
  const assetService = createAssetService({ assetRepository });

  const marketPriceRepository = new PrismaMarketPriceRepository();
  const historicalPriceRepository = new PrismaHistoricalPriceRepository();
  const marketService = createMarketService({
    assetRepository,
    marketPriceRepository,
    historicalPriceRepository,
  });

  const positionRepository = new PrismaPositionRepository();
  const transactionRepository = new PrismaTransactionRepository();

  const positionService = createPositionService({ positionRepository, portfolioService });
  const analyticsService = createAnalyticsService({
    positionRepository,
    portfolioService,
    assetService,
  });
  const transactionService = createTransactionService({
    transactionRepository,
    assetRepository,
    unitOfWork: new PrismaUnitOfWork(),
    portfolioService,
  });
  const overviewService = createOverviewService({
    positionRepository,
    transactionRepository,
    marketPriceRepository,
    historicalPriceRepository,
    portfolioService,
    assetService,
    clock,
  });
  const decisionService = createDecisionService({
    decisionRepository: new PrismaDecisionRepository(),
    decisionEventRepository: new PrismaDecisionEventRepository(),
    assetRepository,
    portfolioService,
  });
  const scenarioService = createScenarioService({
    scenarioRepository: new PrismaScenarioRepository(),
    positionRepository,
    portfolioService,
    assetService,
  });

  return {
    clock,
    portfolioService,
    assetService,
    marketService,
    positionService,
    transactionService,
    analyticsService,
    overviewService,
    decisionService,
    scenarioService,
  };
}

export const composition = buildComposition(systemClock);
