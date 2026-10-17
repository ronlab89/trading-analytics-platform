import {
  PrismaAlertRepository,
  PrismaAssetRepository,
  PrismaDecisionEventRepository,
  PrismaDecisionRepository,
  PrismaHistoricalPriceRepository,
  PrismaMarketPriceRepository,
  PrismaNotificationRepository,
  PrismaPortfolioRepository,
  PrismaPositionRepository,
  PrismaScenarioRepository,
  PrismaTransactionRepository,
  PrismaUnitOfWork,
  PrismaUserPreferenceRepository,
  PrismaWatchlistItemRepository,
} from "@trading/database";
import {
  createAlertService,
  createAnalyticsService,
  createAssetService,
  createDecisionService,
  createMarketService,
  createNotificationService,
  createOverviewService,
  createPerformanceService,
  createPortfolioService,
  createPositionService,
  createRiskService,
  createScenarioService,
  createTransactionService,
  createUserPreferenceService,
  createWatchlistService,
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
  const riskService = createRiskService({
    portfolioService,
    transactionRepository,
    historicalPriceRepository,
    clock,
  });
  const performanceService = createPerformanceService({
    portfolioService,
    transactionRepository,
    historicalPriceRepository,
    clock,
  });
  const transactionService = createTransactionService({
    transactionRepository,
    assetRepository,
    unitOfWork: new PrismaUnitOfWork(),
    portfolioService,
    clock,
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
  const notificationService = createNotificationService({
    notificationRepository: new PrismaNotificationRepository(),
    clock,
  });
  const watchlistService = createWatchlistService({
    watchlistRepository: new PrismaWatchlistItemRepository(),
    assetService,
  });
  const alertService = createAlertService({
    alertRepository: new PrismaAlertRepository(),
    assetService,
    portfolioService,
  });
  const userPreferenceService = createUserPreferenceService({
    userPreferenceRepository: new PrismaUserPreferenceRepository(),
    portfolioService,
  });

  return {
    clock,
    portfolioService,
    assetService,
    marketService,
    positionService,
    transactionService,
    analyticsService,
    riskService,
    performanceService,
    overviewService,
    decisionService,
    scenarioService,
    notificationService,
    watchlistService,
    alertService,
    userPreferenceService,
  };
}

export const composition = buildComposition(systemClock);
