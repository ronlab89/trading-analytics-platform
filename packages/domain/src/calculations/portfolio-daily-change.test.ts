import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import { MarketDataSource } from "../entities/enums";
import type { MarketPrice } from "../entities/market-price";
import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { calculatePortfolioDailyChange } from "./portfolio-daily-change";
import { InsufficientDataError } from "./drawdown";

function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: "portfolio-1",
    userId: "user-1",
    name: "Test Portfolio",
    description: null,
    baseCurrency: "USD",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "position-1",
    portfolioId: "portfolio-1",
    assetId: "asset-1",
    quantity: 10,
    averageEntryPrice: Money.of(100, "USD"),
    currentPrice: Money.of(110, "USD"),
    openedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeMarketPrice(overrides: Partial<MarketPrice> = {}): MarketPrice {
  return {
    assetId: "asset-1",
    price: Money.of(110, "USD"),
    previousPrice: Money.of(100, "USD"),
    change: Money.of(10, "USD"),
    changePercent: 10,
    timestamp: new Date("2026-01-02T00:00:00Z"),
    source: MarketDataSource.MOCK,
    ...overrides,
  };
}

describe("calculatePortfolioDailyChange", () => {
  it("returns a zeroed result for an empty portfolio", () => {
    const result = calculatePortfolioDailyChange(makePortfolio(), [], new Map());

    expect(result.changeValue.equals(Money.zero("USD"))).toBe(true);
    expect(result.changePercent).toBe(0);
    expect(result.excludedAssetIds).toEqual([]);
  });

  it("weights the change by quantity across multiple positions", () => {
    const positions = [
      makePosition({ assetId: "asset-a", quantity: 10 }),
      makePosition({ assetId: "asset-b", quantity: 1 }),
    ];
    const prices = new Map([
      // Small position, huge percentage move: must not dominate the result.
      [
        "asset-a",
        makeMarketPrice({
          assetId: "asset-a",
          previousPrice: Money.of(100, "USD"),
          change: Money.of(1, "USD"),
          changePercent: 1,
        }),
      ],
      [
        "asset-b",
        makeMarketPrice({
          assetId: "asset-b",
          previousPrice: Money.of(1000, "USD"),
          change: Money.of(500, "USD"),
          changePercent: 50,
        }),
      ],
    ]);

    const result = calculatePortfolioDailyChange(makePortfolio(), positions, prices);

    // changeValue = 10*1 + 1*500 = 510; previousValue = 10*100 + 1*1000 = 2000
    expect(result.changeValue.toNumber()).toBe(510);
    expect(result.changePercent).toBeCloseTo((510 / 2000) * 100, 5);
    expect(result.excludedAssetIds).toEqual([]);
  });

  it("excludes positions with no current price data and reports them", () => {
    const positions = [
      makePosition({ assetId: "asset-a", quantity: 10 }),
      makePosition({ assetId: "asset-b", quantity: 5 }),
    ];
    const prices = new Map([["asset-a", makeMarketPrice({ assetId: "asset-a" })]]);

    const result = calculatePortfolioDailyChange(makePortfolio(), positions, prices);

    expect(result.excludedAssetIds).toEqual(["asset-b"]);
    // Only asset-a contributes: changeValue = 10*10 = 100.
    expect(result.changeValue.toNumber()).toBe(100);
  });

  it("throws InsufficientDataError when no held position has price data", () => {
    const positions = [makePosition({ assetId: "asset-a" })];

    expect(() => calculatePortfolioDailyChange(makePortfolio(), positions, new Map())).toThrow(
      InsufficientDataError,
    );
  });

  it("returns 0% change when previous value is zero (degenerate case)", () => {
    const positions = [makePosition({ assetId: "asset-a", quantity: 1 })];
    const prices = new Map([
      [
        "asset-a",
        makeMarketPrice({
          assetId: "asset-a",
          previousPrice: Money.zero("USD"),
          change: Money.zero("USD"),
          changePercent: 0,
        }),
      ],
    ]);

    const result = calculatePortfolioDailyChange(makePortfolio(), positions, prices);
    expect(result.changePercent).toBe(0);
  });
});
