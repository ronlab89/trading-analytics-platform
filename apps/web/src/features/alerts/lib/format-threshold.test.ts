import { describe, expect, it } from "vitest";
import { formatThreshold } from "./format-threshold";

describe("formatThreshold", () => {
  it("writes the threshold as an amount in the currency of the asset", () => {
    expect(formatThreshold({ threshold: 200, currency: "USD" })).toBe("$200.00");
  });

  it("keeps the cents", () => {
    expect(formatThreshold({ threshold: 55.5, currency: "USD" })).toBe("$55.50");
  });

  it("keeps the digits of a threshold finer than cents", () => {
    expect(formatThreshold({ threshold: 0.00012, currency: "USD" })).toBe("$0.00012");
  });

  it("writes a plain number while the asset, and so its currency, is not known", () => {
    expect(formatThreshold({ threshold: 200, currency: null })).toBe("200");
  });
});
