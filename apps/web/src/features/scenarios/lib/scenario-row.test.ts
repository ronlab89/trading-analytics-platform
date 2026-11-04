import type { ScenarioCalculationResponse, ScenarioResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { toScenarioRow } from "./scenario-row";

const usd = (amount: string) => ({ amount, currency: "USD" });

function scenarioWith(changes: ScenarioResponse["changes"]): ScenarioResponse {
  return {
    id: "s1",
    portfolioId: "p1",
    name: "Apple falls",
    description: null,
    baseSnapshotId: null,
    status: "SAVED",
    changes,
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-12T10:00:00.000Z",
  };
}

function calculation(base: string, result: string): ScenarioCalculationResponse {
  const metrics = (total: string) => ({
    totalValue: usd(total),
    investedValue: usd("100000.00"),
    unrealizedPnL: usd("0.00"),
    unrealizedPnLPercent: 0,
  });
  return {
    scenarioId: "s1",
    baseline: metrics(base),
    result: metrics(result),
    difference: { totalValue: usd("0.00"), unrealizedPnL: usd("0.00") },
    unmatchedAssetIds: [],
  };
}

const assets = new Map([
  ["a1", { symbol: "AAPL" }],
  ["a2", { symbol: "MSFT" }],
]);

describe("toScenarioRow", () => {
  it("carries the scenario with the figures of its calculation", () => {
    const row = toScenarioRow(
      scenarioWith([{ assetId: "a1", percentChange: -10 }]),
      assets,
      calculation("125430.00", "121416.00"),
    );

    expect(row).toEqual({
      id: "s1",
      name: "Apple falls",
      status: "SAVED",
      updatedAt: "2026-10-12T10:00:00.000Z",
      mainChange: { assetId: "a1", symbol: "AAPL", percentChange: -10 },
      otherChanges: 0,
      figures: {
        base: usd("125430.00"),
        withScenario: usd("121416.00"),
        impactPercent: expect.closeTo(-3.2, 1) as number,
      },
    });
  });

  it("has no figures while the calculation has not come back", () => {
    const row = toScenarioRow(
      scenarioWith([{ assetId: "a1", percentChange: 5 }]),
      assets,
      undefined,
    );

    expect(row.figures).toBeNull();
  });

  it("names as main variable the change that moves most, and counts the rest", () => {
    const row = toScenarioRow(
      scenarioWith([
        { assetId: "a1", percentChange: 3 },
        { assetId: "a2", percentChange: -8 },
        { assetId: "a1", percentChange: 1 },
      ]),
      assets,
      undefined,
    );

    expect(row.mainChange).toEqual({ assetId: "a2", symbol: "MSFT", percentChange: -8 });
    expect(row.otherChanges).toBe(2);
  });

  it("has no main variable when the scenario changes nothing", () => {
    const row = toScenarioRow(scenarioWith([]), assets, undefined);

    expect(row.mainChange).toBeNull();
    expect(row.otherChanges).toBe(0);
  });

  it("keeps the change of an asset that is not known, with a null symbol", () => {
    const row = toScenarioRow(
      scenarioWith([{ assetId: "gone", percentChange: 2 }]),
      assets,
      undefined,
    );

    expect(row.mainChange).toEqual({ assetId: "gone", symbol: null, percentChange: 2 });
  });

  it("has no impact percent when the base is worth nothing", () => {
    const row = toScenarioRow(scenarioWith([]), assets, calculation("0.00", "0.00"));

    expect(row.figures?.impactPercent).toBeNull();
  });
});
