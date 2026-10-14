import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { Decision } from "@trading/domain";
import { decisionResponseSchema, presentDecision } from "./decision.response.js";

const full: Decision = {
  id: "d1",
  portfolioId: "p1",
  assetId: "a1",
  title: "Buy BTC",
  thesis: "Because",
  direction: "LONG",
  entryPrice: Money.of("100", "USD"),
  targetPrice: Money.of("150.5", "USD"),
  stopPrice: Money.of("90", "USD"),
  riskLevel: "HIGH",
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
  closedAt: new Date("2026-10-20T12:00:00.000Z"),
  outcome: "WIN",
  notes: "n",
};

const sparse: Decision = {
  ...full,
  entryPrice: null,
  targetPrice: null,
  stopPrice: null,
  riskLevel: null,
  closedAt: null,
  outcome: null,
  notes: null,
};

describe("decision presenter", () => {
  it.each([
    ["a full decision", full],
    ["a decision with every optional field null", sparse],
  ])("serializes %s exactly as before", (_name, decision) => {
    const dto = presentDecision(decision);
    expect(dto).toEqual(JSON.parse(JSON.stringify(decision)));
    expect(decisionResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("presents prices as decimal strings", () => {
    expect(presentDecision(full).targetPrice).toEqual({ amount: "150.5", currency: "USD" });
  });

  it("does not leak fields outside the contract", () => {
    expect(Object.keys(presentDecision({ ...full, extra: 1 } as Decision)).sort()).toEqual(
      [
        "assetId",
        "closedAt",
        "createdAt",
        "direction",
        "entryPrice",
        "id",
        "notes",
        "outcome",
        "portfolioId",
        "riskLevel",
        "stopPrice",
        "targetPrice",
        "thesis",
        "title",
      ].sort(),
    );
  });
});
