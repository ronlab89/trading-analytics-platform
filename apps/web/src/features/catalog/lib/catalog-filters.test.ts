import { describe, expect, it } from "vitest";
import {
  activeCatalogFilterCount,
  NO_CATALOG_FILTERS,
  toCatalogQuery,
  type CatalogFilters,
} from "./catalog-filters";

const etfOnNasdaq: CatalogFilters = { assetType: "ETF", exchange: "NASDAQ" };

describe("toCatalogQuery", () => {
  it("asks for nothing extra with no filters and no search", () => {
    expect(toCatalogQuery(NO_CATALOG_FILTERS, "")).toEqual({});
  });

  it("sends the type and the exchange that are chosen", () => {
    expect(toCatalogQuery(etfOnNasdaq, "")).toEqual({ assetType: "ETF", exchange: "NASDAQ" });
    expect(toCatalogQuery({ assetType: "CRYPTO", exchange: null }, "")).toEqual({
      assetType: "CRYPTO",
    });
  });

  it("sends the search trimmed, and leaves it out when it is blank", () => {
    expect(toCatalogQuery(NO_CATALOG_FILTERS, "  apple ")).toEqual({ search: "apple" });
    expect(toCatalogQuery(NO_CATALOG_FILTERS, "   ")).toEqual({});
  });

  it("cuts a search longer than the API accepts instead of sending a 400", () => {
    const { search } = toCatalogQuery(NO_CATALOG_FILTERS, "a".repeat(150));

    expect(search).toHaveLength(100);
  });

  it("combines the search with the filters", () => {
    expect(toCatalogQuery(etfOnNasdaq, "qqq")).toEqual({
      search: "qqq",
      assetType: "ETF",
      exchange: "NASDAQ",
    });
  });
});

describe("activeCatalogFilterCount", () => {
  it("counts the groups that narrow the list", () => {
    expect(activeCatalogFilterCount(NO_CATALOG_FILTERS)).toBe(0);
    expect(activeCatalogFilterCount({ assetType: "ETF", exchange: null })).toBe(1);
    expect(activeCatalogFilterCount(etfOnNasdaq)).toBe(2);
  });
});
