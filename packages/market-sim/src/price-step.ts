import { Money } from "@trading/domain";
import type { PriceProfile } from "./mode.js";
import type { Random } from "./random.js";

/** The lowest price a tick can produce: a price never reaches zero or below (S3). */
export const MIN_PRICE = "0.01";

const PRICE_DECIMALS = 2;

/**
 * The next price after one tick: a geometric random walk. Multiplying by `exp(x)` keeps the
 * price positive for any `x`; the result is rounded to cents and never falls below `MIN_PRICE`.
 * A profile with no volatility does not consume the generator.
 */
export function stepPrice(price: Money, profile: PriceProfile, random: Random): Money {
  const shock = profile.volatility === 0 ? 0 : profile.volatility * random.nextGaussian();
  const factor = Math.exp(profile.drift + shock);
  const next = Money.of(price.multiply(factor).toFixed(PRICE_DECIMALS), price.currency);
  const floor = Money.of(MIN_PRICE, price.currency);
  return next.lessThan(floor) ? floor : next;
}
