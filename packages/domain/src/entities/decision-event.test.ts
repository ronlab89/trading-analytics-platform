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

  it("should accept a valid historical timestamp", () => {
    expect(() => {
      validateNewDecisionEvent({ ...baseInput, timestamp: new Date("2026-06-01T14:30:00Z") });
    }).not.toThrow();
  });

  it("should reject an invalid timestamp", () => {
    expect(() => {
      validateNewDecisionEvent({ ...baseInput, timestamp: new Date("not-a-date") });
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
