import type { HistoricalPrice, Money } from "@trading/domain";
import type { PriceProfile } from "./mode";
import { stepPrice } from "./price-step";
import { createRandom } from "./random";

const DAY_MS = 86_400_000;

/** Simulated units traded per tick; a full day of 1 second ticks is about 864 000 units. */
export const VOLUME_PER_TICK = 10;

/**
 * A day nobody ticked through (the server was offline, or the clock jumped) is generated as a
 * short walk of 48 steps with a daily range of about 1%, much calmer than the live second ticks.
 */
const GENERATED_STEPS = 48;
const GENERATED_PROFILE: PriceProfile = { drift: 0, volatility: 0.0015 };

/** The UTC day of an instant, counted in whole days since 1970-01-01. */
export function utcDay(instant: Date): number {
  return Math.floor(instant.getTime() / DAY_MS);
}

/** 00:00 UTC of a day: the timestamp of its candle, as in the seed data. */
export function utcDayStart(day: number): Date {
  return new Date(day * DAY_MS);
}

/**
 * The candle of one UTC day that no tick covered. It starts at `open` (the close of the day
 * before) and depends only on the seed, the asset, the day and `open`, so it comes out the same
 * whenever and however often it is generated.
 */
export function generateDayCandle(input: {
  seed: string | number;
  assetId: string;
  day: number;
  open: Money;
}): HistoricalPrice {
  const dayKey = utcDayStart(input.day).toISOString().slice(0, 10);
  const random = createRandom(`${String(input.seed)}:${input.assetId}:${dayKey}`);

  let price = input.open;
  let high = input.open;
  let low = input.open;
  for (let step = 0; step < GENERATED_STEPS; step += 1) {
    price = stepPrice(price, GENERATED_PROFILE, random);
    if (price.greaterThan(high)) {
      high = price;
    }
    if (price.lessThan(low)) {
      low = price;
    }
  }

  return {
    assetId: input.assetId,
    timestamp: utcDayStart(input.day),
    open: input.open,
    high,
    low,
    close: price,
    volume: Math.floor(500_000 + random.next() * 500_000),
  };
}
