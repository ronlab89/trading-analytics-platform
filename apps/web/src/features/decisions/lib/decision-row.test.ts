import type { DecisionResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { toDecisionRow } from "./decision-row";

const usd = (amount: string) => ({ amount, currency: "USD" });

const decision: DecisionResponse = {
  id: "d1",
  portfolioId: "p1",
  assetId: "a1",
  title: "Buy AAPL on the dip",
  thesis: "Services keep growing.",
  direction: "LONG",
  entryPrice: usd("150.00"),
  targetPrice: usd("170.00"),
  stopPrice: usd("140.00"),
  riskLevel: "MODERATE",
  createdAt: "2026-06-01T14:00:00.000Z",
  closedAt: null,
  outcome: null,
  notes: null,
};

describe("toDecisionRow", () => {
  it("carries the decision with the symbol and name of its asset", () => {
    expect(toDecisionRow(decision, { symbol: "AAPL", name: "Apple Inc." })).toEqual({
      id: "d1",
      title: "Buy AAPL on the dip",
      symbol: "AAPL",
      name: "Apple Inc.",
      direction: "LONG",
      entryPrice: usd("150.00"),
      targetPrice: usd("170.00"),
      stopPrice: usd("140.00"),
      riskLevel: "MODERATE",
      createdAt: "2026-06-01T14:00:00.000Z",
      outcome: null,
      status: "OPEN",
    });
  });

  it("is closed once it has a closing date", () => {
    const row = toDecisionRow(
      { ...decision, closedAt: "2026-06-20T14:00:00.000Z", outcome: "Target reached" },
      undefined,
    );

    expect(row.status).toBe("CLOSED");
    expect(row.outcome).toBe("Target reached");
  });

  it("keeps the row, without symbol or name, when the asset is not known", () => {
    const row = toDecisionRow(decision, undefined);

    expect(row.symbol).toBeNull();
    expect(row.name).toBeNull();
  });

  it("keeps a missing price as null", () => {
    const row = toDecisionRow({ ...decision, stopPrice: null }, undefined);

    expect(row.stopPrice).toBeNull();
  });
});
