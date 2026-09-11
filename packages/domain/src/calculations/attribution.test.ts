import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { PortfolioStatus } from "../entities/enums";
import { calculateAttribution } from "./attribution";

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

describe("calculateAttribution", () => {
  it("should return an empty array for an empty portfolio", () => {
    const portfolio = buildPortfolio();

    const items = calculateAttribution(portfolio, []);

    expect(items).toEqual([]);
  });

  it("should attribute 100% of the total P/L to a single position", () => {
    const portfolio = buildPortfolio();
    const position = buildPosition();

    const items = calculateAttribution(portfolio, [position]);

    expect(items).toHaveLength(1);
    expect(items[0]?.assetId).toBe("asset_001");
    expect(items[0]?.contribution.equals(Money.of(200, "USD"))).toBe(true);
    expect(items[0]?.percentageOfTotal).toBeCloseTo(100, 5);
  });

  it("should split attribution proportionally across two profitable positions", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
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

    const items = calculateAttribution(portfolio, positions);

    // contributions: 200 and 50, total = 250
    const first = items.find((item) => item.assetId === "asset_001");
    const second = items.find((item) => item.assetId === "asset_002");

    expect(first?.percentageOfTotal).toBeCloseTo((200 / 250) * 100, 5);
    expect(second?.percentageOfTotal).toBeCloseTo((50 / 250) * 100, 5);
  });

  it("should attribute a negative contribution correctly for a losing position", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        averageEntryPrice: Money.of(150, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
    ];

    const items = calculateAttribution(portfolio, positions);

    const losing = items.find((item) => item.assetId === "asset_002");

    expect(losing?.contribution.isNegative()).toBe(true);
  });

  it("should return zero percentageOfTotal for every item when total P/L is exactly zero", () => {
    const portfolio = buildPortfolio();
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
        quantity: 10,
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(120, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 10,
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(80, "USD"),
      }),
    ];

    const items = calculateAttribution(portfolio, positions);

    for (const item of items) {
      expect(item.percentageOfTotal).toBe(0);
    }
  });

  it("should throw CurrencyMismatchError when positions have different currencies", () => {
    const portfolio = buildPortfolio();
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
      calculateAttribution(portfolio, positions);
    }).toThrow();
  });
});
