import { describe, expect, it } from "vitest";
import { DecisionDirection } from "./enums";
import { InvalidDecisionError, validateNewDecision } from "./decision";

const baseInput = {
  portfolioId: "portfolio_001",
  assetId: "asset_001",
  title: "Breakout setup",
  thesis: "Price structure suggests continuation above resistance.",
  direction: DecisionDirection.LONG,
};

describe("validateNewDecision", () => {
  it("should accept a valid decision input", () => {
    expect(() => {
      validateNewDecision(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing portfolioId", () => {
    expect(() => {
      validateNewDecision({ ...baseInput, portfolioId: "" });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewDecision({ ...baseInput, assetId: "" });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject a missing title", () => {
    expect(() => {
      validateNewDecision({ ...baseInput, title: "" });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject a missing thesis", () => {
    expect(() => {
      validateNewDecision({ ...baseInput, thesis: "" });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject an unsupported direction", () => {
    expect(() => {
      validateNewDecision({
        ...baseInput,
        // @ts-expect-error intentionally invalid for the test
        direction: "SIDEWAYS",
      });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject a zero entry price when provided", () => {
    expect(() => {
      validateNewDecision({ ...baseInput, entryPrice: 0 });
    }).toThrow(InvalidDecisionError);
  });

  it("should accept a decision without an entry price", () => {
    expect(() => {
      validateNewDecision(baseInput);
    }).not.toThrow();
  });
});
