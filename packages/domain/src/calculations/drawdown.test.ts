import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { HistoricalPrice } from "../entities/historical-price";
import { InsufficientDataError, calculateDrawdown } from "./drawdown";

function buildPoint(
  timestamp: string,
  close: number,
  overrides: Partial<HistoricalPrice> = {},
): HistoricalPrice {
  return {
    assetId: "asset_001",
    timestamp: new Date(timestamp),
    open: Money.of(close, "USD"),
    high: Money.of(close, "USD"),
    low: Money.of(close, "USD"),
    close: Money.of(close, "USD"),
    volume: 1000,
    ...overrides,
  };
}

describe("calculateDrawdown", () => {
  it("should throw InsufficientDataError with fewer than 2 points", () => {
    const points = [buildPoint("2026-01-01", 100)];

    expect(() => {
      calculateDrawdown(points);
    }).toThrow(InsufficientDataError);
  });

  it("should throw InsufficientDataError with zero points", () => {
    expect(() => {
      calculateDrawdown([]);
    }).toThrow(InsufficientDataError);
  });

  it("should return zero drawdown for a monotonically increasing series", () => {
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 110),
      buildPoint("2026-01-03", 120),
    ];

    const result = calculateDrawdown(points);

    expect(result.maxDrawdownPercent).toBe(0);
  });

  it("should calculate the correct max drawdown for a simple peak-to-trough decline", () => {
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 200),
      buildPoint("2026-01-03", 100),
    ];

    const result = calculateDrawdown(points);

    // (100 - 200) / 200 * 100 = -50%
    expect(result.maxDrawdownPercent).toBeCloseTo(-50, 5);
    expect(result.peakTimestamp).toEqual(new Date("2026-01-02"));
    expect(result.troughTimestamp).toEqual(new Date("2026-01-03"));
  });

  it("should identify the worst drawdown across multiple peaks and troughs", () => {
    const points = [
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 120), // peak 1
      buildPoint("2026-01-03", 108), // -10% from peak 1
      buildPoint("2026-01-04", 150), // new peak
      buildPoint("2026-01-05", 90), // -40% from peak 2, worst
      buildPoint("2026-01-06", 140),
    ];

    const result = calculateDrawdown(points);

    // (90 - 150) / 150 * 100 = -40%
    expect(result.maxDrawdownPercent).toBeCloseTo(-40, 5);
    expect(result.peakTimestamp).toEqual(new Date("2026-01-04"));
    expect(result.troughTimestamp).toEqual(new Date("2026-01-05"));
  });

  it("should not depend on the input being pre-sorted by timestamp", () => {
    const points = [
      buildPoint("2026-01-03", 100),
      buildPoint("2026-01-01", 100),
      buildPoint("2026-01-02", 200),
    ];

    const result = calculateDrawdown(points);

    expect(result.maxDrawdownPercent).toBeCloseTo(-50, 5);
  });
});
