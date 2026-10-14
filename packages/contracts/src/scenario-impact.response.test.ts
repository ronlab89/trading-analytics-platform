import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { PortfolioMetrics } from "@trading/domain";
import {
  presentScenarioCalculation,
  presentScenarioComparison,
  scenarioCalculationResponseSchema,
  scenarioComparisonResponseSchema,
  type ScenarioComparisonSource,
} from "./scenario-impact.response.js";

const usd = (amount: string): Money => Money.of(amount, "USD");

const baseline: PortfolioMetrics = {
  totalValue: usd("1500"),
  investedValue: usd("1000"),
  unrealizedPnL: usd("500"),
  unrealizedPnLPercent: 50,
};

const stressed: PortfolioMetrics = {
  totalValue: usd("1320"),
  investedValue: usd("1000"),
  unrealizedPnL: usd("320"),
  unrealizedPnLPercent: 32,
};

describe("scenario calculation presenter", () => {
  it("serializes the calculation exactly as before", () => {
    const calculation = {
      scenarioId: "s1",
      baseline,
      result: stressed,
      difference: { totalValue: usd("-180"), unrealizedPnL: usd("-180") },
      unmatchedAssetIds: ["a9"],
    };
    const dto = presentScenarioCalculation(calculation);
    expect(dto).toEqual(JSON.parse(JSON.stringify(calculation)));
    expect(dto.difference.totalValue).toEqual({ amount: "-180", currency: "USD" });
    expect(scenarioCalculationResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const dto = presentScenarioCalculation({
      scenarioId: "s1",
      baseline,
      result: stressed,
      difference: { totalValue: usd("0"), unrealizedPnL: usd("0") },
      unmatchedAssetIds: [],
      extra: 1,
    } as Parameters<typeof presentScenarioCalculation>[0]);
    expect(Object.keys(dto).sort()).toEqual(
      ["baseline", "difference", "result", "scenarioId", "unmatchedAssetIds"].sort(),
    );
  });
});

describe("scenario comparison presenter", () => {
  const comparison: ScenarioComparisonSource = {
    baseline: {
      metrics: baseline,
      assets: [
        {
          assetId: "a1",
          value: usd("1500"),
          allocationPercent: 100,
          symbol: "BTC",
          name: "Bitcoin",
        },
        { assetId: "a2", value: usd("0"), allocationPercent: 0, symbol: null, name: null },
      ],
    },
    scenarios: [
      {
        scenarioId: "s1",
        name: "Crash",
        status: "DRAFT",
        metrics: stressed,
        difference: {
          totalValue: usd("-180"),
          totalValuePercent: -12,
          unrealizedPnL: usd("-180"),
        },
        assets: [
          {
            assetId: "a1",
            value: usd("1320"),
            valueDifference: usd("-180"),
            allocationPercent: 100,
            allocationShift: 0,
            symbol: "BTC",
            name: "Bitcoin",
          },
        ],
        unmatchedAssetIds: ["a9"],
      },
      {
        scenarioId: "s2",
        name: "Empty baseline",
        status: "SAVED",
        metrics: baseline,
        difference: { totalValue: usd("0"), totalValuePercent: null, unrealizedPnL: usd("0") },
        assets: [],
        unmatchedAssetIds: [],
      },
    ],
  };

  it("serializes the comparison exactly as before, nulls included", () => {
    const dto = presentScenarioComparison(comparison);
    expect(dto).toEqual(JSON.parse(JSON.stringify(comparison)));
    expect(dto.scenarios[1]?.difference.totalValuePercent).toBeNull();
    expect(dto.baseline.assets[1]?.symbol).toBeNull();
    expect(scenarioComparisonResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("keeps the requested scenario order", () => {
    const dto = presentScenarioComparison(comparison);
    expect(dto.scenarios.map((s) => s.scenarioId)).toEqual(["s1", "s2"]);
  });
});
