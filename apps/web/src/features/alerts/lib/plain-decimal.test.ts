import { describe, expect, it } from "vitest";
import { plainDecimal } from "./plain-decimal";

describe("plainDecimal", () => {
  it("writes whole numbers and cents with two decimals", () => {
    expect(plainDecimal(200)).toBe("200.00");
    expect(plainDecimal(55.5)).toBe("55.50");
  });

  it("keeps the digits finer than cents, without trailing zeros", () => {
    expect(plainDecimal(0.00012)).toBe("0.00012");
    expect(plainDecimal(1.2345)).toBe("1.2345");
  });

  it("never writes an exponent", () => {
    expect(plainDecimal(0.0000001)).toBe("0.0000001");
  });
});
