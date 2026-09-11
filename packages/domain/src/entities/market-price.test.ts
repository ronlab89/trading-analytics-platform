import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import { MarketDataSource } from "./enums";
import { InvalidMarketPriceError, validateNewMarketPrice } from "./market-price";

const baseInput = {
  assetId: "asset_001",
  price: Money.of(184.22, "USD"),
  previousPrice: Money.of(181.4, "USD"),
  change: Money.of(2.82, "USD"),
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
      validateNewMarketPrice({ ...baseInput, price: Money.zero("USD") });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should reject a negative price", () => {
    expect(() => {
      validateNewMarketPrice({ ...baseInput, price: Money.of(-1, "USD") });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should reject a zero previous price", () => {
    expect(() => {
      validateNewMarketPrice({
        ...baseInput,
        previousPrice: Money.zero("USD"),
      });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should reject a negative previous price", () => {
    expect(() => {
      validateNewMarketPrice({
        ...baseInput,
        previousPrice: Money.of(-1, "USD"),
      });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should accept a negative change (price decreased)", () => {
    expect(() => {
      validateNewMarketPrice({
        ...baseInput,
        change: Money.of(-2.82, "USD"),
        changePercent: -1.55,
      });
    }).not.toThrow();
  });

  it("should reject a previous price in a different currency than price", () => {
    expect(() => {
      validateNewMarketPrice({
        ...baseInput,
        previousPrice: Money.of(181.4, "EUR"),
      });
    }).toThrow(InvalidMarketPriceError);
  });

  it("should reject a change in a different currency than price", () => {
    expect(() => {
      validateNewMarketPrice({
        ...baseInput,
        change: Money.of(2.82, "EUR"),
      });
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
