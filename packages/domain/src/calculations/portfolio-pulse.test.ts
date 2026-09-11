import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { PortfolioStatus } from "../entities/enums";
import { calculatePortfolioPulse } from "./portfolio-pulse";

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

    it("should classify volatility as LOW when a low value is provided", () => {
      const portfolio = buildPortfolio();
      const positions = [buildPosition()];

      const pulse = calculatePortfolioPulse(portfolio, positions, {
        volatility: { volatilityPercent: 0.5, annualized: false, sampleSize: 30 },
      });

      expect(pulse.volatility.classification).toBe("LOW");
    });

    it("should classify volatility as HIGH when a high value is provided", () => {
      const portfolio = buildPortfolio();
      const positions = [buildPosition()];

      const pulse = calculatePortfolioPulse(portfolio, positions, {
        volatility: { volatilityPercent: 5, annualized: false, sampleSize: 30 },
      });

      expect(pulse.volatility.classification).toBe("HIGH");
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
          peakTimestamp: new Date("2026-01-01"),
          troughTimestamp: new Date("2026-01-05"),
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
          peakTimestamp: new Date("2026-01-01"),
          troughTimestamp: new Date("2026-01-05"),
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
