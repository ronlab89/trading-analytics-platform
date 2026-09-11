import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { HistoricalPrice } from "../entities/historical-price";
import { InsufficientDataError } from "./drawdown";
import { calculateVolatility } from "./volatility";

function buildPoint(timestamp: string, close: number): HistoricalPrice {
  return {
    assetId: "asset_001",
    timestamp: new Date(timestamp),
    open: Money.of(close, "USD"),
    high: Money.of(close, "USD"),
    low: Money.of(close, "USD"),
    close: Money.of(close, "USD"),
    volume: 1000,
  };
}

describe("calculateVolatility", () => {
  it("should throw InsufficientDataError with fewer than 3 points", () => {
    const points = [buildPoint("2026-01-01", 100), buildPoint("2026-01-02", 110)];

    expect(() => {
      calculateVolatility(points);
    }).toThrow(InsufficientDataError);
  });

  it("should throw InsufficientDataError with zero points", () => {
    expect(() => {
      calculateVolatility([]);
    }).toThrow(InsufficientDataError);
  });

  it("should return zero volatility for a series with constant returns", () => {
    // Constant 10% daily growth → identical returns → zero deviation
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 110),
      buildPoint("2026-01-03", 121),
    ];

    const result = calculateVolatility(points);

    expect(result.volatilityPercent).toBeCloseTo(0, 5);
  });

  it("should return a positive volatility for a series with varying returns", () => {
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 110),
      buildPoint("2026-01-03", 95),
      buildPoint("2026-01-04", 120),
    ];

    const result = calculateVolatility(points);

    expect(result.volatilityPercent).toBeGreaterThan(0);
  });

  it("should report the correct sample size (number of returns, not price points)", () => {
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 110),
      buildPoint("2026-01-03", 95),
      buildPoint("2026-01-04", 120),
    ];

    const result = calculateVolatility(points);

    // 4 price points → 3 daily returns
    expect(result.sampleSize).toBe(3);
  });

  it("should default to non-annualized volatility", () => {
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 110),
      buildPoint("2026-01-03", 95),
    ];

    const result = calculateVolatility(points);

    expect(result.annualized).toBe(false);
  });

  it("should scale volatility by sqrt(252) when annualize is true", () => {
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 110),
      buildPoint("2026-01-03", 95),
      buildPoint("2026-01-04", 120),
    ];

    const daily = calculateVolatility(points, { annualize: false });
    const annualized = calculateVolatility(points, { annualize: true });

    expect(annualized.annualized).toBe(true);
    expect(annualized.volatilityPercent).toBeCloseTo(daily.volatilityPercent * Math.sqrt(252), 5);
  });

  it("should not depend on the input being pre-sorted by timestamp", () => {
    const sorted = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 110),
      buildPoint("2026-01-03", 95),
      buildPoint("2026-01-04", 120),
    ];
    const shuffled = [
      buildPoint("2026-01-04", 120),
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-03", 95),
      buildPoint("2026-01-02", 110),
    ];

    const resultSorted = calculateVolatility(sorted);
    const resultShuffled = calculateVolatility(shuffled);

    expect(resultShuffled.volatilityPercent).toBeCloseTo(resultSorted.volatilityPercent, 10);
  });
});
