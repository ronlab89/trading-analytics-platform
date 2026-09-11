import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { Position } from "../entities/position";
import { PositionMetricsCalculationError, calculatePositionMetrics } from "./position-metrics";

function buildPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "position_001",
    portfolioId: "portfolio_001",
    assetId: "asset_001",
    quantity: 10,
    averageEntryPrice: Money.of(100, "USD"),
    currentPrice: Money.of(120, "USD"),
    openedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("calculatePositionMetrics", () => {
  it("should calculate market value as current price times quantity", () => {
    const metrics = calculatePositionMetrics(buildPosition());

    expect(metrics.marketValue.equals(Money.of(1200, "USD"))).toBe(true);
  });

  it("should calculate cost basis as average entry price times quantity", () => {
    const metrics = calculatePositionMetrics(buildPosition());

    expect(metrics.costBasis.equals(Money.of(1000, "USD"))).toBe(true);
  });

  it("should calculate a positive unrealized P/L for a profitable position", () => {
    const metrics = calculatePositionMetrics(buildPosition());

    expect(metrics.unrealizedPnL.equals(Money.of(200, "USD"))).toBe(true);
    expect(metrics.unrealizedPnL.isPositive()).toBe(true);
  });

  it("should calculate a negative unrealized P/L for a losing position", () => {
    const metrics = calculatePositionMetrics(
      buildPosition({
        averageEntryPrice: Money.of(150, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
    );

    expect(metrics.unrealizedPnL.equals(Money.of(-300, "USD"))).toBe(true);
    expect(metrics.unrealizedPnL.isNegative()).toBe(true);
  });

  it("should calculate unrealizedPnLPercent correctly for a profitable position", () => {
    const metrics = calculatePositionMetrics(buildPosition());

    // costBasis = 1000, unrealizedPnL = 200 → 20%
    expect(metrics.unrealizedPnLPercent).toBeCloseTo(20, 5);
  });

  it("should calculate unrealizedPnLPercent correctly for a losing position", () => {
    const metrics = calculatePositionMetrics(
      buildPosition({
        averageEntryPrice: Money.of(150, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
    );

    // costBasis = 1500, unrealizedPnL = -300 → -20%
    expect(metrics.unrealizedPnLPercent).toBeCloseTo(-20, 5);
  });

  it("should calculate a zero unrealized P/L for a flat position", () => {
    const metrics = calculatePositionMetrics(
      buildPosition({
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(100, "USD"),
      }),
    );

    expect(metrics.unrealizedPnL.isZero()).toBe(true);
    expect(metrics.unrealizedPnLPercent).toBe(0);
  });

  it("should scale correctly with a larger quantity", () => {
    const metrics = calculatePositionMetrics(buildPosition({ quantity: 50 }));

    expect(metrics.marketValue.equals(Money.of(6000, "USD"))).toBe(true);
    expect(metrics.costBasis.equals(Money.of(5000, "USD"))).toBe(true);
  });

  it("should throw when cost basis is zero", () => {
    // Bypasses validateNewPosition on purpose to exercise the defensive
    // guard against a division-by-zero-equivalent calculation.
    const position = buildPosition({
      averageEntryPrice: Money.zero("USD"),
    });

    expect(() => {
      calculatePositionMetrics(position);
    }).toThrow(PositionMetricsCalculationError);
  });
});
