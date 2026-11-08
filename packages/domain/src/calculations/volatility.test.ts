import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money.js";
import type { HistoricalPrice } from "../entities/historical-price.js";
import { InsufficientDataError } from "./drawdown.js";
import { calculateReturnVolatility, calculateVolatility } from "./volatility.js";

function buildPoint(day: number, close: number): HistoricalPrice {
  return {
    assetId: "asset_001",
    timestamp: new Date(Date.UTC(2026, 0, 1 + day)),
    open: Money.of(close, "USD"),
    high: Money.of(close, "USD"),
    low: Money.of(close, "USD"),
    close: Money.of(close, "USD"),
    volume: 1000,
  };
}

/** `count` alternating +1% / -1% returns. */
function alternatingReturns(count: number): Decimal[] {
  return Array.from({ length: count }, (_, i) => new Decimal(i % 2 === 0 ? "0.01" : "-0.01"));
}

/** `count` + 1 closes that grow by the given returns, starting at 100. */
function pricesFromReturns(returns: readonly Decimal[]): HistoricalPrice[] {
  let close = new Decimal(100);
  const points = [buildPoint(0, 100)];
  returns.forEach((rate, i) => {
    close = close.times(rate.plus(1));
    points.push(buildPoint(i + 1, close.toNumber()));
  });
  return points;
}

describe("calculateReturnVolatility", () => {
  it("annualizes the sample standard deviation with sqrt(365)", () => {
    // 20 alternating +-1% returns: mean 0, variance 0.002 / 19, sigma ~ 0.0102598.
    const result = calculateReturnVolatility(alternatingReturns(20));

    expect(result.status).toBe("OK");
    expect(result.sampleSize).toBe(20);
    expect(result.volatilityPercent?.toNumber()).toBeCloseTo(19.601, 3);
  });

  it("is UNKNOWN with null, never 0, under 20 returns", () => {
    const result = calculateReturnVolatility(alternatingReturns(19));

    expect(result).toEqual({ status: "UNKNOWN", volatilityPercent: null, sampleSize: 19 });
  });

  it("is UNKNOWN for an empty series", () => {
    expect(calculateReturnVolatility([])).toEqual({
      status: "UNKNOWN",
      volatilityPercent: null,
      sampleSize: 0,
    });
  });

  it("is zero, with status OK, when every return is equal", () => {
    const result = calculateReturnVolatility(Array.from({ length: 20 }, () => new Decimal("0.01")));

    expect(result.status).toBe("OK");
    expect(result.volatilityPercent?.isZero()).toBe(true);
  });
});

describe("calculateVolatility", () => {
  it("throws InsufficientDataError with fewer than 21 points (20 returns)", () => {
    const points = pricesFromReturns(alternatingReturns(19));

    expect(points).toHaveLength(20);
    expect(() => {
      calculateVolatility(points);
    }).toThrow(InsufficientDataError);
  });

  it("throws InsufficientDataError with zero points", () => {
    expect(() => {
      calculateVolatility([]);
    }).toThrow(InsufficientDataError);
  });

  it("returns the annualized volatility and counts returns, not price points", () => {
    const result = calculateVolatility(pricesFromReturns(alternatingReturns(20)));

    expect(result.sampleSize).toBe(20);
    expect(result.annualized).toBe(true);
    expect(result.volatilityPercent).toBeCloseTo(19.601, 3);
  });

  it("returns zero volatility for a series with constant returns", () => {
    const returns = Array.from({ length: 20 }, () => new Decimal("0.01"));

    const result = calculateVolatility(pricesFromReturns(returns));

    expect(result.volatilityPercent).toBeCloseTo(0, 5);
  });

  it("does not depend on the input being pre-sorted by timestamp", () => {
    const sorted = pricesFromReturns(alternatingReturns(20));
    const shuffled = [...sorted].reverse();

    expect(calculateVolatility(shuffled).volatilityPercent).toBeCloseTo(
      calculateVolatility(sorted).volatilityPercent,
      10,
    );
  });
});
