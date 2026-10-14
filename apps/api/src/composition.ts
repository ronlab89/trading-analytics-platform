import {
  PrismaAssetRepository,
  PrismaHistoricalPriceRepository,
  PrismaMarketPriceRepository,
  PrismaPortfolioRepository,
  PrismaPositionRepository,
  PrismaTransactionRepository,
  PrismaUnitOfWork,
} from "@trading/database";
import {
  createAnalyticsService,
  createAssetService,
  createMarketService,
  createPortfolioService,
  createPositionService,
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
  const marketService = createMarketService({
    assetRepository,
    marketPriceRepository: new PrismaMarketPriceRepository(),
    historicalPriceRepository: new PrismaHistoricalPriceRepository(),
  });

  const positionRepository = new PrismaPositionRepository();

  const positionService = createPositionService({ positionRepository, portfolioService });
  const analyticsService = createAnalyticsService({
    positionRepository,
    portfolioService,
    assetService,
  });
  const transactionService = createTransactionService({
    transactionRepository: new PrismaTransactionRepository(),
    assetRepository,
    unitOfWork: new PrismaUnitOfWork(),
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
  };
}

export const composition = buildComposition(systemClock);
