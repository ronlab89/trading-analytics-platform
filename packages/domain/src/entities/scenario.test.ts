import { describe, expect, it } from "vitest";
import { InvalidScenarioError, validateNewScenario } from "./scenario";

const baseInput = {
  portfolioId: "portfolio_001",
  name: "Increase technology exposure",
};

describe("validateNewScenario", () => {
  it("should accept a valid scenario input", () => {
    expect(() => {
      validateNewScenario(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing portfolioId", () => {
    expect(() => {
      validateNewScenario({ ...baseInput, portfolioId: "" });
    }).toThrow(InvalidScenarioError);
  });

  it("should reject a missing name", () => {
    expect(() => {
      validateNewScenario({ ...baseInput, name: "" });
    }).toThrow(InvalidScenarioError);
  });

  it("should reject an empty name with only whitespace", () => {
    expect(() => {
      validateNewScenario({ ...baseInput, name: "   " });
    }).toThrow(InvalidScenarioError);
  });

  it("should accept an input with an optional description", () => {
    expect(() => {
      validateNewScenario({
        ...baseInput,
        description: "Evaluate higher technology allocation.",
      });
    }).not.toThrow();
  });

  it("should accept an input with an optional baseSnapshotId", () => {
    expect(() => {
      validateNewScenario({
        ...baseInput,
        baseSnapshotId: "snapshot_001",
      });
    }).not.toThrow();
  });
});
