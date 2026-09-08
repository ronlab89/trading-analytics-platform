import { describe, expect, it } from "vitest";
import { MarketDataSource } from "./enums";
import { InvalidMarketPriceError, validateNewMarketPrice } from "./market-price";

const baseInput = {
  assetId: "asset_001",
  price: 184.22,
  previousPrice: 181.4,
  change: 2.82,
  changePercent: 1.55,
  source: MarketDataSource.MOCK,
};

describe("validateNewMarketPrice", () => {
  it("should accept a valid market price input", () => {
    expect(() => {
      validateNewMarketPrice(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewMarketPrice({ ...baseInput, assetId: "" });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should reject a zero price", () => {
    expect(() => {
      validateNewMarketPrice({ ...baseInput, price: 0 });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should reject a zero previous price", () => {
    expect(() => {
      validateNewMarketPrice({ ...baseInput, previousPrice: 0 });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should reject an unsupported source", () => {
    expect(() => {
      validateNewMarketPrice({
        ...baseInput,
        // @ts-expect-error intentionally invalid for the test
        source: "PAID_PROVIDER",
      });
    }).toThrow(InvalidMarketPriceError);
  });
});
