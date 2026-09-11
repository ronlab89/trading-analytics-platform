import { describe, expect, it } from "vitest";
import { InvalidPortfolioError, validateNewPortfolio } from "./portfolio";

const baseInput = {
  userId: "user_001",
  name: "Growth Portfolio",
  baseCurrency: "USD",
};

describe("validateNewPortfolio", () => {
  it("should accept a valid portfolio input", () => {
    expect(() => {
      validateNewPortfolio(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing userId", () => {
    expect(() => {
      validateNewPortfolio({ ...baseInput, userId: "" });
    }).toThrow(InvalidPortfolioError);
  });

  it("should reject a missing name", () => {
    expect(() => {
      validateNewPortfolio({ ...baseInput, name: "" });
    }).toThrow(InvalidPortfolioError);
  });

  it("should reject an empty name with only whitespace", () => {
    expect(() => {
      validateNewPortfolio({ ...baseInput, name: "   " });
    }).toThrow(InvalidPortfolioError);
  });

  it("should reject a lowercase currency code", () => {
    expect(() => {
      validateNewPortfolio({ ...baseInput, baseCurrency: "usd" });
    }).toThrow(InvalidPortfolioError);
  });

  it("should reject a currency code that is not 3 letters", () => {
    expect(() => {
      validateNewPortfolio({ ...baseInput, baseCurrency: "US" });
    }).toThrow(InvalidPortfolioError);
  });
});
