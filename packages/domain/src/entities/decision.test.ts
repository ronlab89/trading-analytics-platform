import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import { DecisionDirection } from "./enums";
import { InvalidDecisionError, validateNewDecision } from "./decision";

const baseInput = {
  portfolioId: "portfolio_001",
  assetId: "asset_001",
  title: "Breakout setup",
  thesis: "Price structure suggests a continuation above resistance.",
  direction: DecisionDirection.LONG,
  entryPrice: Money.of(180, "USD"),
  targetPrice: Money.of(195, "USD"),
  stopPrice: Money.of(174, "USD"),
};

describe("validateNewDecision", () => {
  it("should accept a valid decision input", () => {
    expect(() => {
      validateNewDecision(baseInput);
    }).not.toThrow();
  });

  it("should accept a decision with no price fields at all", () => {
    const { ...rest } = baseInput;
    expect(() => {
      validateNewDecision(rest);
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

  it("should reject a zero entry price", () => {
    expect(() => {
      validateNewDecision({ ...baseInput, entryPrice: Money.zero("USD") });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject a negative target price", () => {
    expect(() => {
      validateNewDecision({
        ...baseInput,
        targetPrice: Money.of(-1, "USD"),
      });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject a zero stop price", () => {
    expect(() => {
      validateNewDecision({ ...baseInput, stopPrice: Money.zero("USD") });
    }).toThrow(InvalidDecisionError);
  });

  it("should accept a decision with only a target price set", () => {
    const { ...rest } = baseInput;
    expect(() => {
      validateNewDecision(rest);
    }).not.toThrow();
  });

  it("should reject mismatched currencies between entry and target price", () => {
    expect(() => {
      validateNewDecision({
        ...baseInput,
        targetPrice: Money.of(195, "EUR"),
      });
    }).toThrow(InvalidDecisionError);
  });

  it("should reject mismatched currencies between target and stop price", () => {
    const { ...rest } = baseInput;
    expect(() => {
      validateNewDecision({
        ...rest,
        stopPrice: Money.of(174, "EUR"),
      });
    }).toThrow(InvalidDecisionError);
  });

  it("should accept a SHORT decision", () => {
    expect(() => {
      validateNewDecision({
        ...baseInput,
        direction: DecisionDirection.SHORT,
        targetPrice: Money.of(165, "USD"),
        stopPrice: Money.of(186, "USD"),
      });
    }).not.toThrow();
  });
});
