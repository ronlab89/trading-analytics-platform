import type { AlertResponse, AssetResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { toAlertRows } from "./alert-row";

function alert(id: string, overrides: Partial<AlertResponse> = {}): AlertResponse {
  return {
    id,
    userId: "u1",
    assetId: "a1",
    portfolioId: null,
    type: "PRICE",
    condition: "ABOVE",
    threshold: 200,
    enabled: true,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...overrides,
  };
}

const apple = {
  id: "a1",
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
} as AssetResponse;

describe("toAlertRows", () => {
  it("joins each alert with the symbol, name and currency of its asset", () => {
    const [row] = toAlertRows([alert("al1")], new Map([["a1", apple]]));

    expect(row).toEqual({
      id: "al1",
      assetId: "a1",
      symbol: "AAPL",
      name: "Apple Inc.",
      currency: "USD",
      condition: "ABOVE",
      threshold: 200,
      enabled: true,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-02T10:00:00.000Z",
    });
  });

  it("keeps the row, with null fields, when the asset is not known", () => {
    const [row] = toAlertRows([alert("al1")], new Map());

    expect(row).toMatchObject({ id: "al1", symbol: null, name: null, currency: null });
  });

  it("leaves out the alerts that are not a price alert on an asset", () => {
    const rows = toAlertRows(
      [
        alert("price"),
        alert("portfolio", { assetId: null, portfolioId: "p1" }),
        alert("allocation", { type: "ALLOCATION" }),
      ],
      new Map([["a1", apple]]),
    );

    expect(rows.map(({ id }) => id)).toEqual(["price"]);
  });

  it("lists the newest first, whatever order the API gave", () => {
    const rows = toAlertRows(
      [
        alert("old", { createdAt: "2026-11-01T10:00:00.000Z" }),
        alert("new", { createdAt: "2026-11-03T10:00:00.000Z" }),
        alert("mid", { createdAt: "2026-11-02T10:00:00.000Z" }),
      ],
      new Map(),
    );

    expect(rows.map(({ id }) => id)).toEqual(["new", "mid", "old"]);
  });

  it("does not reorder the list it was given", () => {
    const list = [
      alert("old", { createdAt: "2026-11-01T10:00:00.000Z" }),
      alert("new", { createdAt: "2026-11-03T10:00:00.000Z" }),
    ];

    toAlertRows(list, new Map());

    expect(list.map(({ id }) => id)).toEqual(["old", "new"]);
  });

  it("is empty for no alerts", () => {
    expect(toAlertRows([], new Map())).toEqual([]);
  });
});
