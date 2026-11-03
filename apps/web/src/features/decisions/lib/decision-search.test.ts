import { describe, expect, it } from "vitest";
import type { DecisionRow } from "../types";
import { searchDecisions } from "./decision-search";

const row = (
  id: string,
  title: string,
  symbol: string | null,
  name: string | null,
): DecisionRow => ({
  id,
  title,
  symbol,
  name,
  direction: "LONG",
  entryPrice: null,
  targetPrice: null,
  stopPrice: null,
  riskLevel: null,
  createdAt: "2026-06-01T14:00:00.000Z",
  outcome: null,
  status: "OPEN",
});

const rows = [
  row("d1", "Buy on the dip", "AAPL", "Apple Inc."),
  row("d2", "Cut the loss", "NVDA", "NVIDIA"),
  row("d3", "Unknown asset", null, null),
];

const ids = (found: DecisionRow[]) => found.map((entry) => entry.id);

describe("searchDecisions", () => {
  it("matches the title, the symbol or the name of the asset, ignoring case", () => {
    expect(ids(searchDecisions(rows, "DIP"))).toEqual(["d1"]);
    expect(ids(searchDecisions(rows, "nvda"))).toEqual(["d2"]);
    expect(ids(searchDecisions(rows, "apple"))).toEqual(["d1"]);
  });

  it("matches everything for blank text", () => {
    expect(ids(searchDecisions(rows, "  "))).toEqual(["d1", "d2", "d3"]);
  });

  it("matches nothing when the text is nowhere", () => {
    expect(searchDecisions(rows, "tesla")).toEqual([]);
  });

  it("does not trip over a row without symbol or name", () => {
    expect(ids(searchDecisions(rows, "unknown"))).toEqual(["d3"]);
  });
});
