import type { AssetResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { activeFilterCount, NO_FILTERS, toFilterQuery } from "./transaction-filters";

const apple: AssetResponse = {
  id: "a1",
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
};

describe("toFilterQuery", () => {
  it("is empty when nothing is filtered, so the request is the one it always was", () => {
    expect(toFilterQuery(NO_FILTERS)).toEqual({});
  });

  it("sends the one type that is checked", () => {
    expect(toFilterQuery({ ...NO_FILTERS, types: ["SELL"] })).toEqual({ type: "SELL" });
  });

  it("sends no type when both are checked, because that is every transaction", () => {
    expect(toFilterQuery({ ...NO_FILTERS, types: ["BUY", "SELL"] })).toEqual({});
  });

  it("sends the id of the asset", () => {
    expect(toFilterQuery({ ...NO_FILTERS, asset: apple })).toEqual({ assetId: "a1" });
  });

  it("covers the whole first and last day of the range, in the user's time zone", () => {
    const query = toFilterQuery({ ...NO_FILTERS, range: { from: "2026-10-01", to: "2026-10-14" } });

    expect(query).toEqual({
      dateFrom: new Date(2026, 9, 1, 0, 0, 0, 0).toISOString(),
      dateTo: new Date(2026, 9, 14, 23, 59, 59, 999).toISOString(),
    });
  });

  it("combines every filter", () => {
    const query = toFilterQuery({
      types: ["BUY"],
      asset: apple,
      range: { from: "2026-10-01", to: "2026-10-14" },
    });

    expect(Object.keys(query).sort()).toEqual(["assetId", "dateFrom", "dateTo", "type"]);
  });
});

describe("activeFilterCount", () => {
  it("counts the type, the asset and the range, one each", () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        types: ["BUY"],
        asset: apple,
        range: { from: "2026-10-01", to: "2026-10-14" },
      }),
    ).toBe(3);
  });

  it("does not count the type when both are checked", () => {
    expect(activeFilterCount({ ...NO_FILTERS, types: ["BUY", "SELL"] })).toBe(0);
  });
});
