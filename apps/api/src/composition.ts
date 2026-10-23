import {
  PrismaAlertRepository,
  PrismaAssetRepository,
  PrismaDecisionEventRepository,
  PrismaDecisionRepository,
  PrismaIdempotencyKeyRepository,
  PrismaJobRepository,
  PrismaHistoricalPriceRepository,
  PrismaMarketEventRepository,
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
  createCsvImportHandler,
  createDecisionService,
  createIdempotencyService,
  createJobNotifier,
  createJobRunner,
  createJobService,
  createMarketService,
  createNotificationService,
  createOverviewService,
  createPerformanceService,
  createPortfolioService,
  createPositionService,
  createRangeAttributionService,
  createRiskService,
  createScenarioService,
  createSimulationService,
  createTransactionService,
  createUserPreferenceService,
  createWatchlistService,
  noopRealtimePublisher,
} from "@trading/application";
import type { Clock, Logger, RealtimePublisher } from "@trading/application";
import { systemClock } from "./clock.js";
import { env } from "./config/env.js";
import { tokenizeCsv } from "./import/csv-tokenizer.js";
import { LOG_EVENTS } from "./logging/events.js";
import { logger as defaultLogger } from "./logging/logger.js";
import { withRequestContext } from "./logging/request-context.js";
import { realtimePublisher } from "./realtime/realtime-runtime.js";
import { createMarketSimulator } from "./simulation/market-simulator.js";

/**
 * Composition root: the one place that builds concrete dependencies and
 * hands them to the use cases.
 * Source: ADR-001 point 4, 06-architecture.md §11.
 *
 * The system clock (`clock.ts`) is wired here, so application and domain
 * code never call `new Date()` (ADR-001 point 8). Each resource moved to
 * `@trading/application` adds its repositories and use cases below.
 */
export { systemClock };

/**
 * `publisher` is how the services hand realtime events to the sockets after a
 * change committed; tests that build their own composition keep the no-op one.
 */
export function buildComposition(
  clock: Clock,
  logger: Logger = withRequestContext(defaultLogger),
  publisher: RealtimePublisher = noopRealtimePublisher,
) {
  const assetRepository = new PrismaAssetRepository();

  const portfolioRepository = new PrismaPortfolioRepository();
  const portfolioService = createPortfolioService({ portfolioRepository });
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
  // Every service that rebuilds the daily value series times it (ADR-009 point 8).
  const seriesTiming = { logger, slowThresholdMs: env.SLOW_REQUEST_THRESHOLD_MS };
  const riskService = createRiskService({
    portfolioService,
    transactionRepository,
    historicalPriceRepository,
    clock,
    ...seriesTiming,
  });
  const performanceService = createPerformanceService({
    portfolioService,
    transactionRepository,
    historicalPriceRepository,
    clock,
    ...seriesTiming,
  });
  const rangeAttributionService = createRangeAttributionService({
    portfolioService,
    assetService,
    transactionRepository,
    historicalPriceRepository,
    clock,
    ...seriesTiming,
  });
  const transactionService = createTransactionService({
    transactionRepository,
    assetRepository,
    unitOfWork: new PrismaUnitOfWork(),
    portfolioService,
    clock,
    realtimePublisher: publisher,
    logger,
  });
  const overviewService = createOverviewService({
    positionRepository,
    transactionRepository,
    marketPriceRepository,
    historicalPriceRepository,
    portfolioService,
    assetService,
    clock,
    ...seriesTiming,
  });
  const decisionService = createDecisionService({
    decisionRepository: new PrismaDecisionRepository(),
    decisionEventRepository: new PrismaDecisionEventRepository(),
    assetRepository,
    portfolioService,
  });
  const scenarioService = createScenarioService({
    scenarioRepository: new PrismaScenarioRepository({
      onChangesSkipped: (skipped) => {
        logger.warn(LOG_EVENTS.scenarioChangesSkipped, { ...skipped });
      },
    }),
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

  const idempotencyService = createIdempotencyService({
    idempotencyKeyRepository: new PrismaIdempotencyKeyRepository(),
    clock,
  });

  const unitOfWork = new PrismaUnitOfWork();
  const jobRepository = new PrismaJobRepository();
  const jobService = createJobService({
    jobRepository,
    portfolioService,
    unitOfWork,
    clock,
    logger,
  });
  // The runner is built here but started by `index.ts`, so tests that load the
  // composition never poll the database.
  const jobRunner = createJobRunner({
    jobRepository,
    handlers: {
      CSV_IMPORT: createCsvImportHandler({
        tokenize: tokenizeCsv,
        portfolioRepository,
        assetRepository,
        transactionRepository,
        unitOfWork,
        clock,
      }),
    },
    clock,
    logger,
    realtimePublisher: publisher,
    notifier: createJobNotifier({
      notificationRepository: new PrismaNotificationRepository(),
      realtimePublisher: publisher,
      logger,
    }),
  });

  // Built here but booted by `index.ts`, so tests that load the composition never tick or touch
  // the database.
  const marketSimulator = createMarketSimulator({
    clock,
    logger,
    publisher,
    assetRepository,
    marketPriceRepository,
    marketEventRepository: new PrismaMarketEventRepository(),
    historicalPriceRepository,
    positionRepository,
  });
  const simulationService = createSimulationService({ control: marketSimulator });

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
    rangeAttributionService,
    overviewService,
    decisionService,
    scenarioService,
    notificationService,
    watchlistService,
    alertService,
    userPreferenceService,
    idempotencyService,
    jobService,
    jobRepository,
    jobRunner,
    marketSimulator,
    simulationService,
  };
}

export const composition = buildComposition(systemClock, undefined, realtimePublisher);
