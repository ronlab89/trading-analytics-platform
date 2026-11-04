import type { PositionResponse, ScenarioResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import {
  changesOf,
  sameChanges,
  variablesOf,
  withPercent,
  type ScenarioVariable,
} from "./scenario-variables";

const usd = (amount: string) => ({ amount, currency: "USD" });

function position(assetId: string, price: string): PositionResponse {
  return {
    id: `pos-${assetId}`,
    portfolioId: "p1",
    assetId,
    quantity: 10,
    averageEntryPrice: usd("100.00"),
    currentPrice: usd(price),
    openedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

const positions = [position("a1", "180.70"), position("a2", "410.20")];
const assets = new Map([
  ["a1", { symbol: "AAPL" }],
  ["a2", { symbol: "MSFT" }],
  ["a3", { symbol: "KO" }],
]);
const changes = (list: ScenarioResponse["changes"]) => list;

describe("variablesOf", () => {
  it("is one variable per position, in the order of the positions, with the price of today", () => {
    expect(variablesOf(positions, changes([]), assets)).toEqual([
      { assetId: "a1", symbol: "AAPL", price: usd("180.70"), percent: 0 },
      { assetId: "a2", symbol: "MSFT", price: usd("410.20"), percent: 0 },
    ]);
  });

  it("carries the change that the scenario already has for each asset", () => {
    const variables = variablesOf(
      positions,
      changes([{ assetId: "a2", percentChange: -5 }]),
      assets,
    );

    expect(variables.map(({ percent }) => percent)).toEqual([0, -5]);
  });

  it("keeps the change of an asset the portfolio no longer holds, with no price, so saving does not drop it", () => {
    const variables = variablesOf(
      positions,
      changes([{ assetId: "a3", percentChange: 4 }]),
      assets,
    );

    expect(variables).toHaveLength(3);
    expect(variables[2]).toEqual({ assetId: "a3", symbol: "KO", price: null, percent: 4 });
  });

  it("has a null symbol for an asset that is not known", () => {
    const variables = variablesOf([], changes([{ assetId: "gone", percentChange: 1 }]), assets);

    expect(variables).toEqual([{ assetId: "gone", symbol: null, price: null, percent: 1 }]);
  });

  it("has nothing to move when there are no positions and no changes", () => {
    expect(variablesOf([], changes([]), assets)).toEqual([]);
  });
});

describe("changesOf", () => {
  const variables: ScenarioVariable[] = [
    { assetId: "a1", symbol: "AAPL", price: usd("180.70"), percent: -10 },
    { assetId: "a2", symbol: "MSFT", price: usd("410.20"), percent: 0 },
    { assetId: "a3", symbol: "KO", price: null, percent: 5 },
  ];

  it("sends only the variables that move, never a zero", () => {
    expect(changesOf(variables)).toEqual([
      { assetId: "a1", percentChange: -10 },
      { assetId: "a3", percentChange: 5 },
    ]);
  });

  it("is an empty list when nothing moves", () => {
    expect(changesOf(variables.map((variable) => ({ ...variable, percent: 0 })))).toEqual([]);
  });

  it("does not turn a negative zero into a change", () => {
    expect(
      changesOf([{ assetId: "a1", symbol: "AAPL", price: usd("180.70"), percent: -0 }]),
    ).toEqual([]);
  });
});

describe("withPercent", () => {
  const variables: ScenarioVariable[] = [
    { assetId: "a1", symbol: "AAPL", price: usd("180.70"), percent: 0 },
    { assetId: "a2", symbol: "MSFT", price: usd("410.20"), percent: 0 },
  ];

  it("moves one variable and leaves the others, without touching the original", () => {
    const moved = withPercent(variables, "a2", 5);

    expect(moved.map(({ percent }) => percent)).toEqual([0, 5]);
    expect(variables.map(({ percent }) => percent)).toEqual([0, 0]);
  });

  it("is the same list when the asset is not there", () => {
    expect(withPercent(variables, "nope", 5)).toEqual(variables);
  });
});

describe("sameChanges", () => {
  it("is true for the same changes in another order", () => {
    expect(
      sameChanges(
        [
          { assetId: "a1", percentChange: -10 },
          { assetId: "a2", percentChange: 5 },
        ],
        [
          { assetId: "a2", percentChange: 5 },
          { assetId: "a1", percentChange: -10 },
        ],
      ),
    ).toBe(true);
  });

  it("is false when a percentage differs, an asset differs or one has more", () => {
    const base = [{ assetId: "a1", percentChange: -10 }];

    expect(sameChanges(base, [{ assetId: "a1", percentChange: -5 }])).toBe(false);
    expect(sameChanges(base, [{ assetId: "a2", percentChange: -10 }])).toBe(false);
    expect(sameChanges(base, [...base, { assetId: "a2", percentChange: 5 }])).toBe(false);
  });

  it("is true for two empty lists", () => {
    expect(sameChanges([], [])).toBe(true);
  });
});
