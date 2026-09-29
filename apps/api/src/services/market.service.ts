import {
  PrismaAssetRepository,
  PrismaHistoricalPriceRepository,
  PrismaMarketPriceRepository,
} from "@trading/database";
import type { HistoricalPrice, MarketPrice } from "@trading/domain";
import { AppError } from "../errors/app-error.js";

const assetRepository = new PrismaAssetRepository();
const marketPriceRepository = new PrismaMarketPriceRepository();
const historicalPriceRepository = new PrismaHistoricalPriceRepository();

async function assertAssetExists(assetId: string): Promise<void> {
  const asset = await assetRepository.getById(assetId);
  if (!asset) {
    throw new AppError("NOT_FOUND", "The requested asset could not be found.", 404);
  }
}

/**
 * Current market price for one asset.
 * Source: FR-021, 07-api-spec.md §17 (Asset Price).
 *
 * Distinguishes two 404 cases with different messages: the asset
 * itself doesn't exist, vs. the asset exists but has no current price
 * yet (e.g. newly added, not yet seeded/simulated). Assets are public
 * reference data with no ownership, so there is no anti-enumeration
 * reason to blur this distinction (unlike portfolio ownership checks
 * elsewhere in this API).
 */
export async function getAssetPrice(assetId: string): Promise<MarketPrice> {
  await assertAssetExists(assetId);

  const price = await marketPriceRepository.getByAssetId(assetId);
  if (!price) {
    throw new AppError("NOT_FOUND", "No current price is available for this asset.", 404);
  }

  return price;
}

/**
 * Batch current prices for several assets at once.
 * Source: FR-044, 07-api-spec.md §19 — exists specifically "to avoid
 * excessive individual requests" from a dashboard showing many assets.
 *
 * Unlike `getAssetPrice`, this never 404s: unknown ids or assets with
 * no current price are simply absent from the result array, matching
 * `AssetRepository.getByIds`'s same "missing means absent" contract.
 */
export function getBatchPrices(assetIds: readonly string[]): Promise<MarketPrice[]> {
  return marketPriceRepository.listByAssetIds([...assetIds]);
}

/**
 * Historical OHLCV candles for one asset within a date range.
 * Source: FR-026, 07-api-spec.md §18.
 *
 * `interval` is accepted by the route/schema layer but not passed down
 * here: only daily candles exist today (see assetHistoryQuerySchema),
 * so there is nothing to branch on yet. Reintroduce the parameter here
 * once a second granularity is actually seeded/computed.
 */
export async function getAssetHistory(
  assetId: string,
  from: Date,
  to: Date,
): Promise<HistoricalPrice[]> {
  await assertAssetExists(assetId);

  return historicalPriceRepository.listByAssetId(assetId, from, to);
}
