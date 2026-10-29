import { describe, expect, it } from "vitest";
import { filterPortfolios } from "./filter-portfolios";

const portfolios = [{ name: "Crecimiento" }, { name: "Renta fija" }, { name: "Educación" }];

describe("filterPortfolios", () => {
  it("keeps every portfolio when the query is empty or only spaces", () => {
    expect(filterPortfolios(portfolios, "")).toEqual(portfolios);
    expect(filterPortfolios(portfolios, "   ")).toEqual(portfolios);
  });

  it("keeps the portfolios whose name contains the query, ignoring case", () => {
    expect(filterPortfolios(portfolios, "RENTA")).toEqual([{ name: "Renta fija" }]);
    expect(filterPortfolios(portfolios, "ci")).toEqual([
      { name: "Crecimiento" },
      { name: "Educación" },
    ]);
  });

  it("ignores accents on both sides", () => {
    expect(filterPortfolios(portfolios, "educacion")).toEqual([{ name: "Educación" }]);
    expect(filterPortfolios(portfolios, "EDUCACIÓN")).toEqual([{ name: "Educación" }]);
  });

  it("ignores the spaces around the query", () => {
    expect(filterPortfolios(portfolios, "  fija ")).toEqual([{ name: "Renta fija" }]);
  });

  it("returns nothing when no name matches", () => {
    expect(filterPortfolios(portfolios, "zzz")).toEqual([]);
  });
});
