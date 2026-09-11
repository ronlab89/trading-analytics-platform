import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { PortfolioStatus } from "../entities/enums";
import { calculatePortfolioMetrics } from "./portfolio-metrics";

function buildPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: "portfolio_001",
    userId: "user_001",
    name: "Main Portfolio",
    description: "Primary trading portfolio",
    baseCurrency: "USD",
    status: PortfolioStatus.ACTIVE,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

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

describe("calculatePortfolioMetrics", () => {
  it("should return zeroed metrics in the portfolio's base currency for an empty portfolio", () => {
    const portfolio = buildPortfolio({ baseCurrency: "USD" });

    const metrics = calculatePortfolioMetrics(portfolio, []);

    expect(metrics.totalValue.equals(Money.zero("USD"))).toBe(true);
    expect(metrics.investedValue.equals(Money.zero("USD"))).toBe(true);
    expect(metrics.unrealizedPnL.equals(Money.zero("USD"))).toBe(true);
    expect(metrics.unrealizedPnLPercent).toBe(0);
  });

  it("should aggregate market value across a single position", () => {
    const portfolio = buildPortfolio();
    const position = buildPosition();

    const metrics = calculatePortfolioMetrics(portfolio, [position]);

    expect(metrics.investedValue.equals(Money.of(1200, "USD"))).toBe(true);
    expect(metrics.totalValue.equals(metrics.investedValue)).toBe(true);
  });

  it("should aggregate market value and cost basis across multiple profitable positions", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        quantity: 10,
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 5,
        averageEntryPrice: Money.of(200, "USD"),
        currentPrice: Money.of(210, "USD"),
      }),
    ];

    const metrics = calculatePortfolioMetrics(portfolio, positions);

    // investedValue = 1200 + 1050 = 2250
    expect(metrics.investedValue.equals(Money.of(2250, "USD"))).toBe(true);
    // unrealizedPnL = (1200 - 1000) + (1050 - 1000) = 200 + 50 = 250
    expect(metrics.unrealizedPnL.equals(Money.of(250, "USD"))).toBe(true);
  });

  it("should net a losing position against a profitable one", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        quantity: 10,
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 10,
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(70, "USD"),
      }),
    ];

    const metrics = calculatePortfolioMetrics(portfolio, positions);

    // costBasis = 1000 + 1000 = 2000
    // marketValue = 1200 + 700 = 1900
    // unrealizedPnL = -100
    expect(metrics.unrealizedPnL.equals(Money.of(-100, "USD"))).toBe(true);
    expect(metrics.unrealizedPnL.isNegative()).toBe(true);
  });

  it("should calculate unrealizedPnLPercent relative to total cost basis", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        quantity: 10,
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 5,
        averageEntryPrice: Money.of(200, "USD"),
        currentPrice: Money.of(210, "USD"),
      }),
    ];

    const metrics = calculatePortfolioMetrics(portfolio, positions);

    // totalCostBasis = 1000 + 1000 = 2000, unrealizedPnL = 250 → 12.5%
    expect(metrics.unrealizedPnLPercent).toBeCloseTo(12.5, 5);
  });

  it("should throw CurrencyMismatchError when positions have different currencies", () => {
    const portfolio = buildPortfolio({ baseCurrency: "USD" });
    const positions = [
      buildPosition({ id: "position_001" }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        averageEntryPrice: Money.of(100, "EUR"),
        currentPrice: Money.of(120, "EUR"),
      }),
    ];

    expect(() => {
      calculatePortfolioMetrics(portfolio, positions);
    }).toThrow();
  });
});
