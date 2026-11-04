import type { ScenarioComparisonResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import type { ScenarioMainChange } from "../types";
import { compareView } from "./scenario-comparison";

const usd = (amount: string) => ({ amount, currency: "USD" });

const metrics = (total: string, pnl: string, percent: number) => ({
  totalValue: usd(total),
  investedValue: usd("100000.00"),
  unrealizedPnL: usd(pnl),
  unrealizedPnLPercent: percent,
});

const baseAsset = (assetId: string, symbol: string | null, allocationPercent: number) => ({
  assetId,
  value: usd("1.00"),
  allocationPercent,
  symbol,
  name: symbol === null ? null : `${symbol} Inc.`,
});

const scenarioAsset = (
  assetId: string,
  symbol: string | null,
  allocationPercent: number,
  allocationShift: number,
) => ({
  assetId,
  value: usd("1.00"),
  valueDifference: usd("0.00"),
  allocationPercent,
  allocationShift,
  symbol,
  name: symbol === null ? null : `${symbol} Inc.`,
});

type ComparedScenario = ScenarioComparisonResponse["scenarios"][number];

const appleFalls: ComparedScenario = {
  scenarioId: "s1",
  name: "Apple falls",
  status: "SAVED",
  metrics: metrics("121416.00", "21416.00", 21.42),
  difference: {
    totalValue: usd("-4014.00"),
    totalValuePercent: -3.2,
    unrealizedPnL: usd("-4014.00"),
  },
  assets: [scenarioAsset("a1", "AAPL", 29.8, -2.2), scenarioAsset("a2", "MSFT", 28.9, 0.9)],
  unmatchedAssetIds: [],
};

const rally: ComparedScenario = {
  scenarioId: "s2",
  name: "Microsoft rallies",
  status: "DRAFT",
  metrics: metrics("127186.00", "27186.00", 27.19),
  difference: {
    totalValue: usd("1756.00"),
    totalValuePercent: 1.4,
    unrealizedPnL: usd("1756.00"),
  },
  assets: [scenarioAsset("a1", "AAPL", 31.6, -0.4), scenarioAsset("a2", "MSFT", 29.5, 1.5)],
  unmatchedAssetIds: ["a9"],
};

const response: ScenarioComparisonResponse = {
  baseline: {
    metrics: metrics("125430.00", "25430.00", 25.43),
    assets: [baseAsset("a1", "AAPL", 32), baseAsset("a2", "MSFT", 28)],
  },
  scenarios: [appleFalls, rally],
};

const mainChanges = new Map<string, ScenarioMainChange | null>([
  ["s1", { assetId: "a1", symbol: "AAPL", percentChange: -10 }],
  ["s2", null],
]);

describe("compareView", () => {
  it("puts the base first and then each scenario, with the letters A, B… in the order they came", () => {
    const { columns } = compareView(response, mainChanges);

    expect(columns.map(({ id, letter }) => [id, letter])).toEqual([
      ["base", null],
      ["s1", "A"],
      ["s2", "B"],
    ]);
  });

  it("gives every column its value, its return and its profit, and the scenarios how far the value moves", () => {
    const { columns } = compareView(response, mainChanges);

    expect(columns[0]).toMatchObject({
      name: null,
      value: usd("125430.00"),
      returnPercent: 25.43,
      profit: usd("25430.00"),
      valueChangePercent: null,
    });
    expect(columns[1]).toMatchObject({
      name: "Apple falls",
      status: "SAVED",
      value: usd("121416.00"),
      returnPercent: 21.42,
      profit: usd("21416.00"),
      valueChangePercent: -3.2,
    });
  });

  it("says the main variable of each scenario, or none when the list does not know it", () => {
    const { columns } = compareView(response, mainChanges);

    expect(columns[1]?.mainChange).toEqual({ assetId: "a1", symbol: "AAPL", percentChange: -10 });
    expect(columns[2]?.mainChange).toBeNull();
    expect(compareView(response, new Map()).columns[1]?.mainChange).toBeNull();
  });

  it("keeps the assets the API could not match, so the screen can say they were left out", () => {
    const { columns } = compareView(response, mainChanges);

    expect(columns[1]?.unmatchedAssetIds).toEqual([]);
    expect(columns[2]?.unmatchedAssetIds).toEqual(["a9"]);
  });

  it("gives one row per asset with the weight in the base and, per scenario, its weight and its shift", () => {
    const { assets } = compareView(response, mainChanges);

    expect(assets).toEqual([
      {
        assetId: "a1",
        symbol: "AAPL",
        name: "AAPL Inc.",
        base: 32,
        scenarios: [
          { weight: 29.8, shift: -2.2 },
          { weight: 31.6, shift: -0.4 },
        ],
      },
      {
        assetId: "a2",
        symbol: "MSFT",
        name: "MSFT Inc.",
        base: 28,
        scenarios: [
          { weight: 28.9, shift: 0.9 },
          { weight: 29.5, shift: 1.5 },
        ],
      },
    ]);
  });

  it("adds an asset only a scenario holds with no weight in the base, and an asset a scenario lacks with none", () => {
    const { assets } = compareView(
      {
        ...response,
        scenarios: [
          {
            ...appleFalls,
            assets: [scenarioAsset("a1", "AAPL", 30, -2), scenarioAsset("a3", "KO", 5, 5)],
          },
        ],
      },
      mainChanges,
    );

    expect(assets.map(({ assetId }) => assetId)).toEqual(["a1", "a2", "a3"]);
    expect(assets[2]).toMatchObject({
      symbol: "KO",
      base: 0,
      scenarios: [{ weight: 5, shift: 5 }],
    });
    expect(assets[1]).toMatchObject({ assetId: "a2", scenarios: [{ weight: 0, shift: -28 }] });
  });

  it("names nothing it does not know and still has the row", () => {
    const { assets } = compareView(
      {
        ...response,
        baseline: { ...response.baseline, assets: [baseAsset("a1", null, 100)] },
        scenarios: [{ ...appleFalls, assets: [scenarioAsset("a1", null, 100, 0)] }],
      },
      mainChanges,
    );

    expect(assets).toEqual([
      {
        assetId: "a1",
        symbol: null,
        name: null,
        base: 100,
        scenarios: [{ weight: 100, shift: 0 }],
      },
    ]);
  });
});
