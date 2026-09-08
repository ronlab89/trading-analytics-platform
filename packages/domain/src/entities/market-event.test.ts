import { describe, expect, it } from "vitest";
import {
  InvalidMarketEventError,
  isStaleMarketEvent,
  validateNewMarketEvent,
} from "./market-event";

const baseInput = {
  assetId: "asset_001",
  price: 184.22,
  sequence: 1201,
};

describe("validateNewMarketEvent", () => {
  it("should accept a valid market event input", () => {
    expect(() => {
      validateNewMarketEvent(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewMarketEvent({ ...baseInput, assetId: "" });
    }).toThrow(InvalidMarketEventError);
  });

  it("should reject a zero price", () => {
    expect(() => {
      validateNewMarketEvent({ ...baseInput, price: 0 });
    }).toThrow(InvalidMarketEventError);
  });

  it("should reject a negative sequence", () => {
    expect(() => {
      validateNewMarketEvent({ ...baseInput, sequence: -1 });
    }).toThrow(InvalidMarketEventError);
  });

  it("should reject a non-integer sequence", () => {
    expect(() => {
      validateNewMarketEvent({ ...baseInput, sequence: 1.5 });
    }).toThrow(InvalidMarketEventError);
  });
});

describe("isStaleMarketEvent", () => {
  it("should consider a lower sequence as stale", () => {
    expect(isStaleMarketEvent(100, 101)).toBe(true);
  });

  it("should consider an equal sequence as stale", () => {
    expect(isStaleMarketEvent(101, 101)).toBe(true);
  });

  it("should consider a higher sequence as not stale", () => {
    expect(isStaleMarketEvent(102, 101)).toBe(false);
  });
});
