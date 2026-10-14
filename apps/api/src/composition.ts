import {
  PrismaAssetRepository,
  PrismaHistoricalPriceRepository,
  PrismaMarketPriceRepository,
  PrismaPortfolioRepository,
} from "@trading/database";
import {
  createAssetService,
  createMarketService,
  createPortfolioService,
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

  return { clock, portfolioService, assetService, marketService };
}

export const composition = buildComposition(systemClock);
