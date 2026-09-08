import { describe, expect, it } from "vitest";
import { InvalidHistoricalPriceError, validateNewHistoricalPrice } from "./historical-price";

const baseInput = {
  assetId: "asset_001",
  open: 180,
  high: 186,
  low: 179,
  close: 184.22,
  volume: 1_500_000,
};

describe("validateNewHistoricalPrice", () => {
  it("should accept a valid OHLCV input", () => {
    expect(() => {
      validateNewHistoricalPrice(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewHistoricalPrice({ ...baseInput, assetId: "" });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject a zero open price", () => {
    expect(() => {
      validateNewHistoricalPrice({ ...baseInput, open: 0 });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject high lower than low", () => {
    expect(() => {
      validateNewHistoricalPrice({ ...baseInput, high: 178, low: 179 });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject high lower than close", () => {
    expect(() => {
      validateNewHistoricalPrice({ ...baseInput, high: 182, close: 184.22 });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject low higher than open", () => {
    expect(() => {
      validateNewHistoricalPrice({ ...baseInput, low: 181, open: 180 });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject negative volume", () => {
    expect(() => {
      validateNewHistoricalPrice({ ...baseInput, volume: -1 });
    }).toThrow(InvalidHistoricalPriceError);
  });
});
