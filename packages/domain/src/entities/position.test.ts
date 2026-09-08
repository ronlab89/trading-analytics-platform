import { describe, expect, it } from "vitest";
import { InvalidPositionError, validateNewPosition } from "./position";

const baseInput = {
  portfolioId: "portfolio_001",
  assetId: "asset_001",
  quantity: 10,
  averageEntryPrice: 150,
  currentPrice: 180,
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

  it("should reject a negative average entry price", () => {
    expect(() => {
      validateNewPosition({ ...baseInput, averageEntryPrice: -1 });
    }).toThrow(InvalidPositionError);
  });

  it("should reject a zero current price", () => {
    expect(() => {
      validateNewPosition({ ...baseInput, currentPrice: 0 });
    }).toThrow(InvalidPositionError);
  });
});
