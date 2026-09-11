import { describe, expect, it } from "vitest";
import { DecisionEventType } from "./enums";
import { InvalidDecisionEventError, validateNewDecisionEvent } from "./decision-event";

const baseInput = {
  decisionId: "decision_001",
  type: DecisionEventType.POSITION_OPENED,
};

describe("validateNewDecisionEvent", () => {
  it("should accept a valid decision event input", () => {
    expect(() => {
      validateNewDecisionEvent(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing decisionId", () => {
    expect(() => {
      validateNewDecisionEvent({ ...baseInput, decisionId: "" });
    }).toThrow(InvalidDecisionEventError);
  });

  it("should reject an unsupported event type", () => {
    expect(() => {
      validateNewDecisionEvent({
        ...baseInput,
        // @ts-expect-error intentionally invalid for the test
        type: "UNKNOWN_EVENT",
      });
    }).toThrow(InvalidDecisionEventError);
  });
});
