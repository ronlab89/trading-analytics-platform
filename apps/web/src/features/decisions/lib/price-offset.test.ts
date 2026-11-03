import { describe, expect, it } from "vitest";
import { percentFromEntry } from "./price-offset";

const usd = (amount: string) => ({ amount, currency: "USD" });

describe("percentFromEntry", () => {
  it("says how far above the entry a price is", () => {
    expect(percentFromEntry(usd("100.00"), usd("117.00"))).toBeCloseTo(17);
  });

  it("is negative for a price under the entry", () => {
    expect(percentFromEntry(usd("160.00"), usd("152.00"))).toBeCloseTo(-5);
  });

  it("has no answer without an entry or without a price", () => {
    expect(percentFromEntry(null, usd("10.00"))).toBeNull();
    expect(percentFromEntry(usd("10.00"), null)).toBeNull();
  });

  it("has no answer for a zero entry", () => {
    expect(percentFromEntry(usd("0.00"), usd("10.00"))).toBeNull();
  });
});
