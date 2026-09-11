import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import { InvalidPositionError, validateNewPosition } from "./position";

const baseInput = {
  portfolioId: "portfolio_001",
  assetId: "asset_001",
  quantity: 10,
  averageEntryPrice: Money.of(100, "USD"),
  currentPrice: Money.of(120, "USD"),
};

describe("validateNewPosition", () => {
  it("should accept a valid position input", () => {
    expect(() => {
      validateNewPosition(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing portfolioId", () => {
    expect(() => {
      validateNewPosition({ ...baseInput, portfolioId: "" });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewPosition({ ...baseInput, assetId: "" });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a zero quantity", () => {
    expect(() => {
      validateNewPosition({ ...baseInput, quantity: 0 });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a negative quantity", () => {
    expect(() => {
      validateNewPosition({ ...baseInput, quantity: -5 });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a zero average entry price", () => {
    expect(() => {
      validateNewPosition({
        ...baseInput,
        averageEntryPrice: Money.zero("USD"),
      });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a negative average entry price", () => {
    expect(() => {
      validateNewPosition({
        ...baseInput,
        averageEntryPrice: Money.of(-10, "USD"),
      });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a zero current price", () => {
    expect(() => {
      validateNewPosition({ ...baseInput, currentPrice: Money.zero("USD") });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a negative current price", () => {
    expect(() => {
      validateNewPosition({
        ...baseInput,
        currentPrice: Money.of(-1, "USD"),
      });
    }).toThrow(InvalidPositionError);
  });

  it("should reject mismatched currencies between entry and current price", () => {
    expect(() => {
      validateNewPosition({
        ...baseInput,
        averageEntryPrice: Money.of(100, "USD"),
        currentPrice: Money.of(120, "EUR"),
      });
    }).toThrow(InvalidPositionError);
  });

  it("should accept a position with a loss (current price below entry price)", () => {
    expect(() => {
      validateNewPosition({
        ...baseInput,
        averageEntryPrice: Money.of(150, "USD"),
        currentPrice: Money.of(120, "USD"),
      });
    }).not.toThrow();
  });
});
