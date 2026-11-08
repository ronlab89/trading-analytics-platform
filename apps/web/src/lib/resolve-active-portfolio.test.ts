import type { PortfolioResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { resolveActivePortfolio } from "./resolve-active-portfolio";

function portfolio(id: string, status: PortfolioResponse["status"] = "ACTIVE"): PortfolioResponse {
  return {
    id,
    userId: "u1",
    name: id,
    description: null,
    baseCurrency: "USD",
    status,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("resolveActivePortfolio", () => {
  it("returns the selected portfolio when it is still active", () => {
    const list = [portfolio("a"), portfolio("b")];

    expect(resolveActivePortfolio(list, "b")?.id).toBe("b");
  });

  it("falls back to the first active portfolio when nothing is selected", () => {
    expect(resolveActivePortfolio([portfolio("a"), portfolio("b")], undefined)?.id).toBe("a");
  });

  it("falls back when the selected portfolio no longer exists", () => {
    expect(resolveActivePortfolio([portfolio("a")], "gone")?.id).toBe("a");
  });

  it("never picks an archived portfolio, selected or not", () => {
    const list = [portfolio("old", "ARCHIVED"), portfolio("a")];

    expect(resolveActivePortfolio(list, "old")?.id).toBe("a");
    expect(resolveActivePortfolio([portfolio("old", "ARCHIVED")], undefined)).toBeUndefined();
  });

  it("returns nothing for an empty list", () => {
    expect(resolveActivePortfolio([], "a")).toBeUndefined();
  });
});
