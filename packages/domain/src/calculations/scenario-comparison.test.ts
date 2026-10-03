import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import { PortfolioStatus } from "../entities/enums";
import { calculatePortfolioMetrics } from "./portfolio-metrics";
import { calculateScenarioImpact } from "./scenario-impact";
import { compareScenarioImpacts } from "./scenario-comparison";

function buildPortfolio(): Portfolio {
  return {
    id: "portfolio_001",
    userId: "user_001",
    name: "Main Portfolio",
    description: null,
    baseCurrency: "USD",
    status: PortfolioStatus.ACTIVE,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function buildPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "position_001",
    portfolioId: "portfolio_001",
    assetId: "asset_a",
    quantity: 10,
    averageEntryPrice: Money.of(100, "USD"),
    currentPrice: Money.of(100, "USD"),
    openedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

/** Baseline: 10 x 100 = 1000 in asset A, 5 x 200 = 1000 in asset B. Total 2000, 50/50. */
function buildPositions(): Position[] {
  return [
    buildPosition(),
    buildPosition({
      id: "position_002",
      assetId: "asset_b",
      quantity: 5,
      averageEntryPrice: Money.of(200, "USD"),
      currentPrice: Money.of(200, "USD"),
    }),
  ];
}

describe("compareScenarioImpacts", () => {
  it("should report the baseline value and allocation of each asset", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), []);

    expect(result.scenarios).toEqual([]);
    expect(result.baseline.metrics.totalValue.toString()).toBe("2000");
    expect(result.baseline.assets).toHaveLength(2);
    expect(result.baseline.assets.map((a) => a.allocationPercent)).toEqual([50, 50]);
  });

  it("should order the baseline assets by value, largest first", () => {
    const positions = [
      buildPosition({ assetId: "asset_a", currentPrice: Money.of(10, "USD") }),
      buildPosition({
        id: "position_002",
        assetId: "asset_b",
        currentPrice: Money.of(50, "USD"),
      }),
    ];

    const result = compareScenarioImpacts(buildPortfolio(), positions, []);

    expect(result.baseline.assets.map((a) => a.assetId)).toEqual(["asset_b", "asset_a"]);
  });

  it("should report the portfolio-level difference of a scenario", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      { id: "rally", changes: [{ assetId: "asset_a", percentChange: 10 }] },
    ]);

    const [rally] = result.scenarios;
    expect(rally?.scenarioId).toBe("rally");
    expect(rally?.metrics.totalValue.toString()).toBe("2100");
    expect(rally?.difference.totalValue.toString()).toBe("100");
    expect(rally?.difference.unrealizedPnL.toString()).toBe("100");
    expect(rally?.difference.totalValuePercent).toBeCloseTo(5, 6);
  });

  it("should break the difference down per asset", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      { id: "rally", changes: [{ assetId: "asset_a", percentChange: 10 }] },
    ]);

    const assets = result.scenarios[0]?.assets ?? [];
    const assetA = assets.find((a) => a.assetId === "asset_a");
    const assetB = assets.find((a) => a.assetId === "asset_b");

    expect(assetA?.value.toString()).toBe("1100");
    expect(assetA?.valueDifference.toString()).toBe("100");
    expect(assetB?.value.toString()).toBe("1000");
    expect(assetB?.valueDifference.isZero()).toBe(true);
  });

  it("should report the allocation and its shift in percentage points", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      { id: "rally", changes: [{ assetId: "asset_a", percentChange: 10 }] },
    ]);

    const assets = result.scenarios[0]?.assets ?? [];
    const assetA = assets.find((a) => a.assetId === "asset_a");
    const assetB = assets.find((a) => a.assetId === "asset_b");

    // 1100 / 2100 and 1000 / 2100
    expect(assetA?.allocationPercent).toBeCloseTo(52.380952, 5);
    expect(assetA?.allocationShift).toBeCloseTo(2.380952, 5);
    expect(assetB?.allocationPercent).toBeCloseTo(47.619048, 5);
    expect(assetB?.allocationShift).toBeCloseTo(-2.380952, 5);
  });

  it("should order a scenario's assets by the size of their difference, largest first", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      {
        id: "crash",
        changes: [
          { assetId: "asset_b", percentChange: -20 },
          { assetId: "asset_a", percentChange: -50 },
        ],
      },
    ]);

    const assets = result.scenarios[0]?.assets ?? [];
    expect(assets.map((a) => a.assetId)).toEqual(["asset_a", "asset_b"]);
    expect(assets.map((a) => a.valueDifference.toString())).toEqual(["-500", "-200"]);
    expect(result.scenarios[0]?.difference.totalValuePercent).toBeCloseTo(-35, 6);
  });

  it("should compare several scenarios against the same baseline, in the given order", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      { id: "crash", changes: [{ assetId: "asset_a", percentChange: -50 }] },
      { id: "rally", changes: [{ assetId: "asset_a", percentChange: 10 }] },
    ]);

    expect(result.scenarios.map((s) => s.scenarioId)).toEqual(["crash", "rally"]);
    expect(result.scenarios[0]?.difference.totalValue.toString()).toBe("-500");
    expect(result.scenarios[1]?.difference.totalValue.toString()).toBe("100");
    expect(result.baseline.metrics.totalValue.toString()).toBe("2000");
  });

  it("should report no difference for a scenario without changes", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      { id: "untouched", changes: [] },
    ]);

    const [entry] = result.scenarios;
    expect(entry?.difference.totalValue.isZero()).toBe(true);
    expect(entry?.difference.totalValuePercent).toBe(0);
    expect(entry?.assets.every((a) => a.valueDifference.isZero())).toBe(true);
    expect(entry?.assets.every((a) => a.allocationShift === 0)).toBe(true);
  });

  it("should ignore changes for assets the portfolio does not hold", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      { id: "ghost", changes: [{ assetId: "asset_unheld", percentChange: 50 }] },
    ]);

    const [entry] = result.scenarios;
    expect(entry?.difference.totalValue.isZero()).toBe(true);
    expect(entry?.assets.map((a) => a.assetId).sort()).toEqual(["asset_a", "asset_b"]);
  });

  it("should handle a portfolio without positions", () => {
    const result = compareScenarioImpacts(
      buildPortfolio(),
      [],
      [{ id: "empty", changes: [{ assetId: "asset_a", percentChange: 10 }] }],
    );

    expect(result.baseline.assets).toEqual([]);
    expect(result.baseline.metrics.totalValue.isZero()).toBe(true);
    expect(result.scenarios[0]?.assets).toEqual([]);
    expect(result.scenarios[0]?.difference.totalValuePercent).toBeNull();
  });

  it("should report a zero allocation for every asset when the scenario wipes out the portfolio", () => {
    const result = compareScenarioImpacts(buildPortfolio(), buildPositions(), [
      {
        id: "wipeout",
        changes: [
          { assetId: "asset_a", percentChange: -100 },
          { assetId: "asset_b", percentChange: -100 },
        ],
      },
    ]);

    const [entry] = result.scenarios;
    expect(entry?.metrics.totalValue.isZero()).toBe(true);
    expect(entry?.difference.totalValuePercent).toBeCloseTo(-100, 6);
    expect(entry?.assets.every((a) => a.allocationPercent === 0)).toBe(true);
  });

  it("should agree with calculateScenarioImpact and calculatePortfolioMetrics", () => {
    const portfolio = buildPortfolio();
    const positions = buildPositions();
    const changes = [{ assetId: "asset_a", percentChange: -12 }];

    const comparison = compareScenarioImpacts(portfolio, positions, [{ id: "s", changes }]);
    const impact = calculateScenarioImpact(portfolio, positions, changes);

    expect(comparison.baseline.metrics).toEqual(calculatePortfolioMetrics(portfolio, positions));
    expect(comparison.scenarios[0]?.metrics).toEqual(impact.scenario);
    expect(
      comparison.scenarios[0]?.difference.totalValue.equals(impact.difference.totalValue),
    ).toBe(true);
  });

  it("should not mutate the positions or the scenarios", () => {
    const positions = Object.freeze(buildPositions());
    const changes = Object.freeze([Object.freeze({ assetId: "asset_a", percentChange: -50 })]);
    const scenarios = Object.freeze([Object.freeze({ id: "s", changes })]);

    compareScenarioImpacts(buildPortfolio(), positions, scenarios);

    expect(positions[0]?.currentPrice.toString()).toBe("100");
    expect(positions[1]?.currentPrice.toString()).toBe("200");
  });
});
