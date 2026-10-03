import { describe, expect, it } from "vitest";
import { InvalidScenarioError, validateNewScenario, validateScenarioChanges } from "./scenario";

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

  it("should accept an input with valid changes", () => {
    expect(() => {
      validateNewScenario({
        ...baseInput,
        changes: [{ assetId: "asset_001", percentChange: 10 }],
      });
    }).not.toThrow();
  });

  it("should reject an input with invalid changes", () => {
    expect(() => {
      validateNewScenario({
        ...baseInput,
        changes: [{ assetId: "asset_001", percentChange: -150 }],
      });
    }).toThrow(InvalidScenarioError);
  });
});

describe("validateScenarioChanges", () => {
  it("should accept an empty list of changes", () => {
    expect(() => {
      validateScenarioChanges([]);
    }).not.toThrow();
  });

  it("should accept positive, negative and zero percentages", () => {
    expect(() => {
      validateScenarioChanges([
        { assetId: "asset_001", percentChange: 15 },
        { assetId: "asset_002", percentChange: -10 },
        { assetId: "asset_003", percentChange: 0 },
      ]);
    }).not.toThrow();
  });

  it("should accept exactly -100% (the price falls to zero)", () => {
    expect(() => {
      validateScenarioChanges([{ assetId: "asset_001", percentChange: -100 }]);
    }).not.toThrow();
  });

  it("should reject a percentage below -100%", () => {
    expect(() => {
      validateScenarioChanges([{ assetId: "asset_001", percentChange: -100.01 }]);
    }).toThrow(InvalidScenarioError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "should reject a non-finite percentage (%s)",
    (percentChange) => {
      expect(() => {
        validateScenarioChanges([{ assetId: "asset_001", percentChange }]);
      }).toThrow(InvalidScenarioError);
    },
  );

  it("should reject a change without an asset", () => {
    expect(() => {
      validateScenarioChanges([{ assetId: "  ", percentChange: 5 }]);
    }).toThrow(InvalidScenarioError);
  });

  it("should reject the same asset appearing twice", () => {
    expect(() => {
      validateScenarioChanges([
        { assetId: "asset_001", percentChange: 5 },
        { assetId: "asset_001", percentChange: -5 },
      ]);
    }).toThrow(InvalidScenarioError);
  });
});
