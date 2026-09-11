import { describe, expect, it } from "vitest";
import { InvalidWatchlistItemError, validateNewWatchlistItem } from "./watchlist-item";

const baseInput = {
  userId: "user_001",
  assetId: "asset_001",
};

describe("validateNewWatchlistItem", () => {
  it("should accept a valid watchlist item input", () => {
    expect(() => {
      validateNewWatchlistItem(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing userId", () => {
    expect(() => {
      validateNewWatchlistItem({ ...baseInput, userId: "" });
    }).toThrow(InvalidWatchlistItemError);
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewWatchlistItem({ ...baseInput, assetId: "" });
    }).toThrow(InvalidWatchlistItemError);
  });
});
