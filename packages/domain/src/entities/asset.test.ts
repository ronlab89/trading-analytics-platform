import { describe, expect, it } from "vitest";
import { AssetType } from "./enums";
import { InvalidAssetError, validateNewAsset } from "./asset";

const baseInput = {
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: AssetType.STOCK,
  currency: "USD",
  exchange: "NASDAQ",
};

describe("validateNewAsset", () => {
  it("should accept a valid asset input", () => {
    expect(() => {
      validateNewAsset(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing symbol", () => {
    expect(() => {
      validateNewAsset({ ...baseInput, symbol: "" });
    }).toThrow(InvalidAssetError);
  });

  it("should reject a missing name", () => {
    expect(() => {
      validateNewAsset({ ...baseInput, name: "" });
    }).toThrow(InvalidAssetError);
  });

  it("should reject a missing currency", () => {
    expect(() => {
      validateNewAsset({ ...baseInput, currency: "" });
    }).toThrow(InvalidAssetError);
  });

  it("should reject an unsupported asset type", () => {
    expect(() => {
      validateNewAsset({
        ...baseInput,
        // @ts-expect-error intentionally invalid for the test
        assetType: "COMMODITY",
      });
    }).toThrow(InvalidAssetError);
  });
});
