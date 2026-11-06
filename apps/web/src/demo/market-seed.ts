import { AssetType, MarketDataSource, Money } from "@trading/domain";
import type {
  AssetRepository,
  HistoricalPriceRepository,
  MarketPriceRepository,
} from "@trading/domain";

interface SeedAsset {
  readonly symbol: string;
  readonly name: string;
  readonly assetType: AssetType;
  readonly exchange: string;
  readonly currency: string;
  /** Last close, in the currency of the asset. */
  readonly price: number;
  /** Move of the last session, in percent. */
  readonly changePercent: number;
}

/** A small fixed market so the first screens have something to show; the full seed is FE4.2. */
const SEED_ASSETS: readonly SeedAsset[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: AssetType.STOCK,
    exchange: "NASDAQ",
    currency: "USD",
    price: 189.5,
    changePercent: 1.2,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    assetType: AssetType.STOCK,
    exchange: "NASDAQ",
    currency: "USD",
    price: 415.2,
    changePercent: -0.6,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    assetType: AssetType.STOCK,
    exchange: "NASDAQ",
    currency: "USD",
    price: 875.3,
    changePercent: 2.4,
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    assetType: AssetType.ETF,
    exchange: "NYSE",
    currency: "USD",
    price: 512.8,
    changePercent: 0.4,
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    assetType: AssetType.CRYPTO,
    exchange: "CRYPTO",
    currency: "USD",
    price: 67250,
    changePercent: -1.8,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    assetType: AssetType.CRYPTO,
    exchange: "CRYPTO",
    currency: "USD",
    price: 3480,
    changePercent: 0.9,
  },
];

const HISTORY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MarketSeedRepositories {
  readonly assetRepository: AssetRepository;
  readonly marketPriceRepository: MarketPriceRepository;
  readonly historicalPriceRepository: HistoricalPriceRepository;
}

/** Deterministic wave around the last close: the same seed gives the same chart (ADR-012 point 1). */
function closeOf(base: number, dayIndex: number): number {
  return Math.round(base * (1 + 0.03 * Math.sin(dayIndex / 3)) * 100) / 100;
}

export async function seedMarket(repositories: MarketSeedRepositories, now: Date): Promise<void> {
  const { assetRepository, marketPriceRepository, historicalPriceRepository } = repositories;

  for (const seed of SEED_ASSETS) {
    const asset = await assetRepository.create({
      symbol: seed.symbol,
      name: seed.name,
      assetType: seed.assetType,
      exchange: seed.exchange,
      currency: seed.currency,
    });
    const money = (amount: number) => Money.of(amount.toFixed(2), seed.currency);
    const previous = Math.round((seed.price / (1 + seed.changePercent / 100)) * 100) / 100;

    await marketPriceRepository.upsert({
      assetId: asset.id,
      price: money(seed.price),
      previousPrice: money(previous),
      change: money(seed.price - previous),
      changePercent: seed.changePercent,
      source: MarketDataSource.MOCK,
      timestamp: now,
    });

    for (let day = HISTORY_DAYS; day >= 1; day -= 1) {
      const close = closeOf(seed.price, HISTORY_DAYS - day);
      await historicalPriceRepository.create({
        assetId: asset.id,
        open: money(close * 0.995),
        high: money(close * 1.01),
        low: money(close * 0.985),
        close: money(close),
        volume: 1_000_000 + day * 10_000,
        timestamp: new Date(now.getTime() - day * DAY_MS),
      });
    }
  }
}
