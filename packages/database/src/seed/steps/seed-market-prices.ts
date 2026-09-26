import { validateNewMarketPrice, Money, MarketDataSource } from "@trading/domain";
import { PrismaMarketPriceRepository } from "../../repositories/prisma-market-price-repository.js";
import { SEED_HISTORICAL_PRICE_SERIES, generateDailyCandles } from "../data/historical-prices.js";
import { resolveAssetId } from "../resolve.js";
import type { SeedContext } from "../context.js";

const marketPriceRepository = new PrismaMarketPriceRepository();

/**
 * Seeds the current MarketPrice snapshot for every seeded asset.
 * Source: 05-data-model.md §18, FR-044, 07-api-spec.md §17 (Asset Price).
 *
 * Derives `price`/`previousPrice` from the same generated candle series
 * used by `seedHistoricalPrices` (the last two candles' closes), rather
 * than inventing separate figures — this keeps the "current price" and
 * "most recent historical close" consistent with each other (05-data-
 * model.md §36, "Mock data must contain meaningful variation" but also
 * "Relationships must remain internally consistent").
 *
 * Regenerates candles from the same deterministic blueprints instead of
 * reading them back from the database: cheap (in-memory, no query) and
 * guarantees the exact same values `seedHistoricalPrices` persisted,
 * with no risk of drift between the two steps.
 *
 * `timestamp` is the seed run time (now), not a historical candle date:
 * a MarketPrice represents "when this price was last observed", which
 * for a freshly seeded demo is the moment the seed ran.
 */
export async function seedMarketPrices(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding current market prices...");

  const now = new Date();

  for (const series of SEED_HISTORICAL_PRICE_SERIES) {
    const assetId = resolveAssetId(context, series.assetSymbol);
    const candles = generateDailyCandles(series);

    const latest = candles[candles.length - 1];
    const previous = candles[candles.length - 2];

    if (!latest || !previous) {
      throw new Error(
        `[seed] seedMarketPrices requires at least 2 candles for ${series.assetSymbol}.`,
      );
    }

    const price = Money.of(latest.close, series.currency);
    const previousPrice = Money.of(previous.close, series.currency);
    const change = price.subtract(previousPrice);
    const changePercent = (change.toNumber() / previousPrice.toNumber()) * 100;

    const input = {
      assetId,
      price,
      previousPrice,
      change,
      changePercent,
      source: MarketDataSource.MOCK,
      timestamp: now,
    };

    validateNewMarketPrice(input);
    await marketPriceRepository.upsert(input);
  }

  return context;
}
