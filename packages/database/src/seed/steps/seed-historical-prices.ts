import { validateNewHistoricalPrice, Money } from "@trading/domain";
import { PrismaHistoricalPriceRepository } from "../../repositories/prisma-historical-price-repository.js";
import { SEED_HISTORICAL_PRICE_SERIES, generateDailyCandles } from "../data/historical-prices.js";
import { resolveAssetId } from "../resolve.js";
import type { SeedContext } from "../context.js";

const historicalPriceRepository = new PrismaHistoricalPriceRepository();

/**
 * Seeds OHLCV historical price candles for every seeded asset.
 * Source: 05-data-model.md §20, FR-026 (Historical Performance).
 *
 * Sequential awaits (not batched/parallelized) are intentional here:
 * this runs once, in a dev/seed context, not on a request path — see
 * NFR-070 (avoid premature optimization / artificial complexity).
 */
export async function seedHistoricalPrices(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding historical prices...");

  for (const series of SEED_HISTORICAL_PRICE_SERIES) {
    const assetId = resolveAssetId(context, series.assetSymbol);
    const candles = generateDailyCandles(series);

    for (const candle of candles) {
      const input = {
        assetId,
        timestamp: candle.timestamp,
        open: Money.of(candle.open, series.currency),
        high: Money.of(candle.high, series.currency),
        low: Money.of(candle.low, series.currency),
        close: Money.of(candle.close, series.currency),
        volume: candle.volume,
      };

      validateNewHistoricalPrice(input);
      await historicalPriceRepository.create(input);
    }
  }

  return context;
}
