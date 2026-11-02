import type { OverviewResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { topMovers } from "./top-movers";

type OverviewPosition = OverviewResponse["positions"][number];

function position(symbol: string | null, changePercent: number | null): OverviewPosition {
  return {
    asset: symbol === null ? null : { id: symbol, symbol, name: symbol, assetType: "STOCK" },
    dailyChange:
      changePercent === null
        ? null
        : { changeValue: { amount: "1.00", currency: "USD" }, changePercent },
  } as OverviewPosition;
}

describe("topMovers", () => {
  it("orders by the size of the move, whichever way it went", () => {
    const movers = topMovers(
      [position("KO", -0.6), position("NVDA", 3.8), position("JNJ", -1.4), position("AAPL", 2.1)],
      5,
    );

    expect(movers.map((m) => m.symbol)).toEqual(["NVDA", "AAPL", "JNJ", "KO"]);
    expect(movers[2]?.percent).toBe(-1.4);
  });

  it("keeps only the requested number", () => {
    const movers = topMovers([position("A", 1), position("B", 2), position("C", 3)], 2);

    expect(movers.map((m) => m.symbol)).toEqual(["C", "B"]);
  });

  it("leaves out positions with no change today or no known asset", () => {
    const movers = topMovers([position("A", null), position(null, 5), position("B", 1)], 5);

    expect(movers).toEqual([{ symbol: "B", percent: 1 }]);
  });
});
