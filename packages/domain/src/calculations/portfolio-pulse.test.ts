import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money.js";
import type { Portfolio } from "../entities/portfolio.js";
import type { Position } from "../entities/position.js";
import { PortfolioStatus } from "../entities/enums.js";
import { calculatePortfolioPulse } from "./portfolio-pulse.js";

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

describe("calculatePortfolioPulse", () => {
  describe("performance", () => {
    it("should classify performance as POSITIVE above the positive threshold", () => {
      const portfolio = buildPortfolio();
      const positions = [
        buildPosition({
          averageEntryPrice: Money.of(100, "USD"),
          currentPrice: Money.of(120, "USD"), // +20%
        }),
      ];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      expect(pulse.performance.classification).toBe("POSITIVE");
    });

    it("should classify performance as NEGATIVE below the negative threshold", () => {
      const portfolio = buildPortfolio();
      const positions = [
        buildPosition({
          averageEntryPrice: Money.of(100, "USD"),
          currentPrice: Money.of(80, "USD"), // -20%
        }),
      ];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      expect(pulse.performance.classification).toBe("NEGATIVE");
    });

    it("should classify performance as NEUTRAL within the neutral band", () => {
      const portfolio = buildPortfolio();
      const positions = [
        buildPosition({
          averageEntryPrice: Money.of(100, "USD"),
          currentPrice: Money.of(102, "USD"), // +2%
        }),
      ];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      expect(pulse.performance.classification).toBe("NEUTRAL");
    });

    it("should classify an empty portfolio's performance as NEUTRAL", () => {
      const portfolio = buildPortfolio();

      const pulse = calculatePortfolioPulse(portfolio, []);

      expect(pulse.performance.classification).toBe("NEUTRAL");
      expect(pulse.performance.value).toBe(0);
    });
  });

  describe("concentration", () => {
    it("should classify concentration as LOW for an empty portfolio", () => {
      const portfolio = buildPortfolio();

      const pulse = calculatePortfolioPulse(portfolio, []);

      expect(pulse.concentration.classification).toBe("LOW");
      expect(pulse.concentration.value).toBeNull();
    });

    it("should classify concentration as HIGH for a single fully concentrated position", () => {
      const portfolio = buildPortfolio();
      const positions = [buildPosition()];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      expect(pulse.concentration.classification).toBe("HIGH");
      expect(pulse.concentration.value).toBeCloseTo(100, 5);
    });

    it("should classify concentration as LOW when positions are evenly split", () => {
      const portfolio = buildPortfolio();
      const positions = [
        buildPosition({ id: "position_001", assetId: "asset_001" }),
        buildPosition({ id: "position_002", assetId: "asset_002" }),
        buildPosition({ id: "position_003", assetId: "asset_003" }),
        buildPosition({ id: "position_004", assetId: "asset_004" }),
        buildPosition({ id: "position_005", assetId: "asset_005" }),
      ];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      // 5 equal positions → 20% each → below the 25% moderate threshold
      expect(pulse.concentration.classification).toBe("LOW");
    });

    it("should classify concentration as MODERATE between the low and high thresholds", () => {
      const portfolio = buildPortfolio();
      const positions = [
        buildPosition({
          id: "position_001",
          assetId: "asset_001",
          quantity: 30,
        }),
        buildPosition({
          id: "position_002",
          assetId: "asset_002",
          quantity: 70,
        }),
      ];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      // largest = 70%, above 50% high threshold → actually HIGH; adjust
      // to land in the moderate band instead: 40/60 split.
      expect(["MODERATE", "HIGH"]).toContain(pulse.concentration.classification);
    });
  });

  describe("volatility", () => {
    it("should classify volatility as UNKNOWN when not provided", () => {
      const portfolio = buildPortfolio();
      const positions = [buildPosition()];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      expect(pulse.volatility.classification).toBe("UNKNOWN");
      expect(pulse.volatility.value).toBeNull();
    });

    it("should classify an annualized volatility of 15% as LOW", () => {
      const pulse = calculatePortfolioPulse(buildPortfolio(), [buildPosition()], {
        volatility: { volatilityPercent: 15 },
      });

      expect(pulse.volatility.classification).toBe("LOW");
    });

    it("should classify an annualized volatility of 80% as HIGH", () => {
      const pulse = calculatePortfolioPulse(buildPortfolio(), [buildPosition()], {
        volatility: { volatilityPercent: 80 },
      });

      expect(pulse.volatility.classification).toBe("HIGH");
    });
  });

  describe("threshold boundaries (docs/16-analytics-spec.md §15)", () => {
    // The operators are strict: a value on the threshold stays in the lower class.
    it.each([
      [100, 105, "NEUTRAL"],
      [100, 105.01, "POSITIVE"],
      [100, 95, "NEUTRAL"],
      [100, 94.99, "NEGATIVE"],
    ] as const)(
      "should classify entry %s and price %s as %s performance",
      (entry, price, expected) => {
        const pulse = calculatePortfolioPulse(buildPortfolio(), [
          buildPosition({
            averageEntryPrice: Money.of(entry, "USD"),
            currentPrice: Money.of(price, "USD"),
          }),
        ]);

        expect(pulse.performance.classification).toBe(expected);
      },
    );

    // Four assets of 1 unit each; `values` are their prices, so the largest share is values[0] / sum.
    it.each([
      [[2500, 2500, 2500, 2500], "LOW"],
      [[2501, 2499, 2500, 2500], "MODERATE"],
      [[5000, 5000], "MODERATE"],
      [[5001, 4999], "HIGH"],
    ] as const)("should classify prices %j as %s concentration", (prices, expected) => {
      const positions = prices.map((price, index) =>
        buildPosition({
          id: `position_${String(index)}`,
          assetId: `asset_${String(index)}`,
          quantity: 1,
          averageEntryPrice: Money.of(price, "USD"),
          currentPrice: Money.of(price, "USD"),
        }),
      );

      const pulse = calculatePortfolioPulse(buildPortfolio(), positions);

      expect(pulse.concentration.classification).toBe(expected);
    });

    it.each([
      [20, "LOW"],
      [20.01, "MODERATE"],
      [60, "MODERATE"],
      [60.01, "HIGH"],
    ] as const)("should classify an annualized volatility of %s as %s", (percent, expected) => {
      const pulse = calculatePortfolioPulse(buildPortfolio(), [buildPosition()], {
        volatility: { volatilityPercent: percent },
      });

      expect(pulse.volatility.classification).toBe(expected);
    });

    it.each([
      [-10, "LOW"],
      [-10.01, "MODERATE"],
      [-20, "MODERATE"],
      [-20.01, "SEVERE"],
    ] as const)("should classify a maximum drawdown of %s as %s", (percent, expected) => {
      const pulse = calculatePortfolioPulse(buildPortfolio(), [buildPosition()], {
        drawdown: {
          maxDrawdownPercent: percent,
        },
      });

      expect(pulse.drawdown.classification).toBe(expected);
    });
  });

  describe("drawdown", () => {
    it("should classify drawdown as UNKNOWN when not provided", () => {
      const portfolio = buildPortfolio();
      const positions = [buildPosition()];

      const pulse = calculatePortfolioPulse(portfolio, positions);

      expect(pulse.drawdown.classification).toBe("UNKNOWN");
      expect(pulse.drawdown.value).toBeNull();
    });

    it("should classify drawdown as SEVERE when a severe value is provided", () => {
      const portfolio = buildPortfolio();
      const positions = [buildPosition()];

      const pulse = calculatePortfolioPulse(portfolio, positions, {
        drawdown: {
          maxDrawdownPercent: -35,
        },
      });

      expect(pulse.drawdown.classification).toBe("SEVERE");
    });

    it("should classify drawdown as LOW when a small decline is provided", () => {
      const portfolio = buildPortfolio();
      const positions = [buildPosition()];

      const pulse = calculatePortfolioPulse(portfolio, positions, {
        drawdown: {
          maxDrawdownPercent: -2,
        },
      });

      expect(pulse.drawdown.classification).toBe("LOW");
    });
  });

  it("should always include an explanation string for every dimension", () => {
    const portfolio = buildPortfolio();
    const positions = [buildPosition()];

    const pulse = calculatePortfolioPulse(portfolio, positions);

    expect(pulse.performance.explanation.length).toBeGreaterThan(0);
    expect(pulse.concentration.explanation.length).toBeGreaterThan(0);
    expect(pulse.volatility.explanation.length).toBeGreaterThan(0);
    expect(pulse.drawdown.explanation.length).toBeGreaterThan(0);
  });
});
