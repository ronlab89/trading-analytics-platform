import { Money } from "@trading/domain";
import { describe, expect, it } from "vitest";
import { MarketMode, modeProfile } from "./mode.js";
import { MIN_PRICE, stepPrice } from "./price-step.js";
import type { Random } from "./random.js";

/** A generator whose gaussian draw is fixed, to compute the expected price by hand. */
function fixedGaussian(value: number): Random {
  return { next: () => 0.5, nextGaussian: () => value };
}

const hundred = Money.of("100.00", "USD");

describe("stepPrice", () => {
  it("keeps the price when the draw is zero in NORMAL mode: 100 * exp(0) = 100.00", () => {
    const next = stepPrice(hundred, modeProfile(MarketMode.NORMAL), fixedGaussian(0));
    expect(next.toString()).toBe("100");
    expect(next.currency).toBe("USD");
  });

  it("applies the volatility in NORMAL mode: 100 * exp(0.0005 * 2) = 100.10005 -> 100.10", () => {
    const next = stepPrice(hundred, modeProfile(MarketMode.NORMAL), fixedGaussian(2));
    expect(next.toString()).toBe("100.1");
  });

  it("applies the drift in BULLISH mode: 100 * exp(0.00005) = 100.005 -> 100.01", () => {
    const next = stepPrice(hundred, modeProfile(MarketMode.BULLISH), fixedGaussian(0));
    expect(next.toString()).toBe("100.01");
  });

  it("applies the drift in BEARISH mode: 100 * exp(-0.0005 * 2 - 0.00005) = 99.895 -> 99.90", () => {
    const next = stepPrice(hundred, modeProfile(MarketMode.BEARISH), fixedGaussian(-2));
    expect(next.toString()).toBe("99.9");
  });

  it("does not consume the generator when the profile has no volatility", () => {
    let draws = 0;
    const counting: Random = {
      next: () => 0.5,
      nextGaussian: () => {
        draws += 1;
        return 0;
      },
    };
    stepPrice(hundred, modeProfile(MarketMode.PAUSED), counting);
    expect(draws).toBe(0);
  });

  it("never goes below the minimum price, even after an extreme drop", () => {
    const tiny = Money.of(MIN_PRICE, "USD");
    const next = stepPrice(tiny, modeProfile(MarketMode.VOLATILE), fixedGaussian(-1000));
    expect(next.toString()).toBe(MIN_PRICE);
    expect(next.isPositive()).toBe(true);
  });
});
