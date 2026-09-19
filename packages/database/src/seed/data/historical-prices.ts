export interface HistoricalPriceSeriesBlueprint {
  readonly assetSymbol: string;
  readonly currency: string;
  readonly days: number;
  readonly endDate: Date;
  readonly startPrice: number;
  readonly endPrice: number;
  readonly volatilityPercent: number;
  readonly volumeBase: number;
}

export interface DailyCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Source: 05-data-model.md §20 (Historical Price). 30 daily candles per
 * asset, ending 2026-09-14 — enough to render a non-trivial chart without
 * simulating an exchange-accurate calendar (weekends included on purpose,
 * for simplicity; this is illustrative data, not a real market feed).
 *
 * Start/end prices chosen so each series' final close matches the
 * `currentPrice` already seeded for that asset's Position in Step 6.3
 * (AAPL, MSFT, VOO, BTC, ETH). TSLA and QQQ have no seeded Position, so
 * their end prices are freestanding, reasonable current-market figures.
 */
export const SEED_HISTORICAL_PRICE_SERIES: readonly HistoricalPriceSeriesBlueprint[] = [
  {
    assetSymbol: "AAPL",
    currency: "USD",
    days: 30,
    endDate: new Date("2026-09-14T00:00:00Z"),
    startPrice: 160,
    endPrice: 184.22,
    volatilityPercent: 1.5,
    volumeBase: 55_000_000,
  },
  {
    assetSymbol: "MSFT",
    currency: "USD",
    days: 30,
    endDate: new Date("2026-09-14T00:00:00Z"),
    startPrice: 410,
    endPrice: 385,
    volatilityPercent: 1.5,
    volumeBase: 22_000_000,
  },
  {
    assetSymbol: "VOO",
    currency: "USD",
    days: 30,
    endDate: new Date("2026-09-14T00:00:00Z"),
    startPrice: 475,
    endPrice: 481,
    volatilityPercent: 0.8,
    volumeBase: 3_500_000,
  },
  {
    assetSymbol: "QQQ",
    currency: "USD",
    days: 30,
    endDate: new Date("2026-09-14T00:00:00Z"),
    startPrice: 495,
    endPrice: 505,
    volatilityPercent: 0.8,
    volumeBase: 40_000_000,
  },
  {
    assetSymbol: "TSLA",
    currency: "USD",
    days: 30,
    endDate: new Date("2026-09-14T00:00:00Z"),
    startPrice: 230,
    endPrice: 265,
    volatilityPercent: 3,
    volumeBase: 90_000_000,
  },
  {
    assetSymbol: "BTC",
    currency: "USD",
    days: 30,
    endDate: new Date("2026-09-14T00:00:00Z"),
    startPrice: 85000,
    endPrice: 112450.2,
    volatilityPercent: 4,
    volumeBase: 1200,
  },
  {
    assetSymbol: "ETH",
    currency: "USD",
    days: 30,
    endDate: new Date("2026-09-14T00:00:00Z"),
    startPrice: 3300,
    endPrice: 3100,
    volatilityPercent: 4,
    volumeBase: 8000,
  },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic OHLCV generator — see module notes in Step 6.5 above.
 * Same input always produces the same output; no randomness involved.
 */
export function generateDailyCandles(series: HistoricalPriceSeriesBlueprint): DailyCandle[] {
  const { days, endDate, startPrice, endPrice, volatilityPercent, volumeBase } = series;
  const swing = volatilityPercent / 100;
  const candles: DailyCandle[] = [];

  for (let i = 0; i < days; i += 1) {
    const progress = days === 1 ? 1 : i / (days - 1);
    const trendPrice = startPrice + (endPrice - startPrice) * progress;
    // Oscillation amplitude shrinks to zero as progress -> 1, so the
    // trend converges cleanly toward endPrice by the final candle.
    const oscillation = Math.sin(i * 0.9) * trendPrice * swing * 0.4 * (1 - progress);
    const mid = trendPrice + oscillation;

    const dayDirection = Math.sin(i * 1.7) >= 0 ? 1 : -1;
    const open = round2(mid - dayDirection * mid * swing * 0.3);
    const close = round2(mid + dayDirection * mid * swing * 0.3);
    const margin = Math.max(round2(mid * swing * 0.2), 0.01);
    const high = round2(Math.max(open, close) + margin);
    const low = round2(Math.max(0.01, Math.min(open, close) - margin));

    const timestamp = new Date(endDate);
    timestamp.setUTCDate(timestamp.getUTCDate() - (days - 1 - i));

    const volume = Math.round(volumeBase * (0.7 + 0.3 * Math.abs(Math.sin(i * 1.3))));

    candles.push({ timestamp, open, high, low, close, volume });
  }

  const last = candles[candles.length - 1];
  if (!last) {
    throw new Error("[seed] generateDailyCandles produced no candles.");
  }

  // Pin the final candle's close to `endPrice` exactly, so the chart
  // ends consistent with the Position.currentPrice seeded in Step 6.3.
  last.close = round2(endPrice);
  const finalMargin = Math.max(round2(last.close * swing * 0.2), 0.01);
  last.high = round2(Math.max(last.open, last.close) + finalMargin);
  last.low = round2(Math.max(0.01, Math.min(last.open, last.close) - finalMargin));

  return candles;
}
