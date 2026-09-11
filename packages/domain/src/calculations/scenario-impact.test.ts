import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { PortfolioStatus } from "../entities/enums";
import { calculateScenarioImpact } from "./scenario-impact";

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

describe("calculateScenarioImpact", () => {
  it("should return identical baseline and scenario metrics when no changes are provided", () => {
    const portfolio = buildPortfolio();
    const positions = [buildPosition()];

    const result = calculateScenarioImpact(portfolio, positions, []);

    expect(result.scenario.totalValue.equals(result.baseline.totalValue)).toBe(true);
    expect(result.difference.totalValue.isZero()).toBe(true);
  });

  it("should not mutate the original positions array or its objects", () => {
    const portfolio = buildPortfolio();
    const position = buildPosition();
    const positions = [position];

    calculateScenarioImpact(portfolio, positions, [{ assetId: "asset_001", percentChange: -12 }]);

    expect(positions[0]).toBe(position);
    expect(position.currentPrice.equals(Money.of(120, "USD"))).toBe(true);
  });

  it("should apply a negative percent change to the matching position's current price", () => {
    const portfolio = buildPortfolio();
    const positions = [buildPosition({ currentPrice: Money.of(100, "USD") })];

    const result = calculateScenarioImpact(portfolio, positions, [
      { assetId: "asset_001", percentChange: -12 },
    ]);

    // scenario market value = 100 * 0.88 * 10 = 880
    expect(result.scenario.totalValue.equals(Money.of(880, "USD"))).toBe(true);
  });

  it("should apply a positive percent change to the matching position's current price", () => {
    const portfolio = buildPortfolio();
    const positions = [buildPosition({ currentPrice: Money.of(100, "USD") })];

    const result = calculateScenarioImpact(portfolio, positions, [
      { assetId: "asset_001", percentChange: 5 },
    ]);

    // scenario market value = 100 * 1.05 * 10 = 1050
    expect(result.scenario.totalValue.equals(Money.of(1050, "USD"))).toBe(true);
  });

  it("should leave positions with no matching change untouched", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
        currentPrice: Money.of(100, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        currentPrice: Money.of(50, "USD"),
      }),
    ];

    const result = calculateScenarioImpact(portfolio, positions, [
      { assetId: "asset_001", percentChange: -50 },
    ]);

    // asset_001: 100 * 0.5 * 10 = 500
    // asset_002: unchanged, 50 * 10 = 500
    // total = 1000
    expect(result.scenario.totalValue.equals(Money.of(1000, "USD"))).toBe(true);
  });

  it("should calculate a negative difference when the scenario is worse than baseline", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
    ];

    const result = calculateScenarioImpact(portfolio, positions, [
      { assetId: "asset_001", percentChange: -50 },
    ]);

    expect(result.difference.totalValue.isNegative()).toBe(true);
    expect(result.difference.unrealizedPnL.isNegative()).toBe(true);
  });

  it("should handle an empty positions array", () => {
    const portfolio = buildPortfolio();

    const result = calculateScenarioImpact(
      portfolio,
      [],
      [{ assetId: "asset_001", percentChange: -12 }],
    );

    expect(result.baseline.totalValue.isZero()).toBe(true);
    expect(result.scenario.totalValue.isZero()).toBe(true);
    expect(result.difference.totalValue.isZero()).toBe(true);
  });

  it("should apply multiple changes across different assets independently", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
        quantity: 10,
        currentPrice: Money.of(100, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 10,
        currentPrice: Money.of(100, "USD"),
      }),
    ];

    const result = calculateScenarioImpact(portfolio, positions, [
      { assetId: "asset_001", percentChange: -10 },
      { assetId: "asset_002", percentChange: 10 },
    ]);

    // asset_001: 100 * 0.9 * 10 = 900
    // asset_002: 100 * 1.1 * 10 = 1100
    // total = 2000 (same as baseline, gains offset losses)
    expect(result.scenario.totalValue.equals(Money.of(2000, "USD"))).toBe(true);
  });
});
