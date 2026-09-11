import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import { InvalidHistoricalPriceError, validateNewHistoricalPrice } from "./historical-price";

const baseInput = {
  assetId: "asset_001",
  open: Money.of(180, "USD"),
  high: Money.of(186, "USD"),
  low: Money.of(179, "USD"),
  close: Money.of(184.22, "USD"),
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
      validateNewHistoricalPrice({ ...baseInput, open: Money.zero("USD") });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject a negative close price", () => {
    expect(() => {
      validateNewHistoricalPrice({
        ...baseInput,
        close: Money.of(-1, "USD"),
      });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject high lower than low", () => {
    expect(() => {
      validateNewHistoricalPrice({
        ...baseInput,
        high: Money.of(178, "USD"),
        low: Money.of(179, "USD"),
      });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject high lower than close", () => {
    expect(() => {
      validateNewHistoricalPrice({
        ...baseInput,
        high: Money.of(182, "USD"),
        close: Money.of(184.22, "USD"),
      });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject low higher than open", () => {
    expect(() => {
      validateNewHistoricalPrice({
        ...baseInput,
        low: Money.of(181, "USD"),
        open: Money.of(180, "USD"),
      });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should accept high equal to open and close (flat top)", () => {
    expect(() => {
      validateNewHistoricalPrice({
        ...baseInput,
        open: Money.of(180, "USD"),
        high: Money.of(180, "USD"),
        low: Money.of(175, "USD"),
        close: Money.of(180, "USD"),
      });
    }).not.toThrow();
  });

  it("should accept low equal to open and close (flat bottom)", () => {
    expect(() => {
      validateNewHistoricalPrice({
        ...baseInput,
        open: Money.of(180, "USD"),
        high: Money.of(185, "USD"),
        low: Money.of(180, "USD"),
        close: Money.of(180, "USD"),
      });
    }).not.toThrow();
  });

  it("should reject OHLC values with mismatched currencies", () => {
    expect(() => {
      validateNewHistoricalPrice({
        ...baseInput,
        close: Money.of(184.22, "EUR"),
      });
    }).toThrow(InvalidHistoricalPriceError);
  });

  it("should reject negative volume", () => {
    expect(() => {
      validateNewHistoricalPrice({ ...baseInput, volume: -1 });
    }).toThrow(InvalidHistoricalPriceError);
  });
});
