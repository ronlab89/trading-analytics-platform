import { describe, expect, it } from "vitest";
import { concentrationOf } from "./concentration";

const group = (label: string, percentage: number) => ({
  key: label,
  label,
  marketValue: { amount: "100.00", currency: "USD" },
  percentage,
});

describe("concentrationOf", () => {
  it("is the largest group and its weight", () => {
    expect(concentrationOf([group("MSFT", 22), group("AAPL", 34), group("KO", 12)])).toEqual({
      percent: 34,
      label: "AAPL",
      level: "MODERATE",
    });
  });

  it("has nothing to measure without groups", () => {
    expect(concentrationOf([])).toBeNull();
  });

  it("classifies with the thresholds of the spec, where 25 is low and 50 is moderate", () => {
    expect(concentrationOf([group("A", 25)])?.level).toBe("LOW");
    expect(concentrationOf([group("A", 25.01)])?.level).toBe("MODERATE");
    expect(concentrationOf([group("A", 50)])?.level).toBe("MODERATE");
    expect(concentrationOf([group("A", 50.01)])?.level).toBe("HIGH");
  });
});
