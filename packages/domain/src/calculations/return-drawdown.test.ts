import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateReturnDrawdown } from "./return-drawdown";
import type { DailyReturnPoint } from "./period-performance";

/** One point per day from 2026-01-02 (the baseline is 2026-01-01). */
function series(rates: readonly (string | null)[]): DailyReturnPoint[] {
  return rates.map((rate, index) => ({
    date: new Date(Date.UTC(2026, 0, 2 + index)),
    rate: rate === null ? null : new Decimal(rate),
  }));
}

function day(dayOfMonth: number): Date {
  return new Date(Date.UTC(2026, 0, dayOfMonth));
}

describe("calculateReturnDrawdown", () => {
  it("measures the maximum and current drawdown on the cumulative index", () => {
    // I = 1.10, 0.88, 0.924
    const result = calculateReturnDrawdown(series(["0.1", "-0.2", "0.05"]));

    expect(result.status).toBe("OK");
    expect(result.maxDrawdown?.toFixed(6)).toBe("-0.200000");
    expect(result.currentDrawdown?.toFixed(6)).toBe("-0.160000");
    expect(result.peakDate).toEqual(day(2));
    expect(result.troughDate).toEqual(day(3));
  });

  it("keeps the first peak and the first trough when they repeat", () => {
    // I = 1.25, 1.00, 1.25, 1.00
    const result = calculateReturnDrawdown(series(["0.25", "-0.2", "0.25", "-0.2"]));

    expect(result.maxDrawdown?.toFixed(6)).toBe("-0.200000");
    expect(result.currentDrawdown?.toFixed(6)).toBe("-0.200000");
    expect(result.peakDate).toEqual(day(2));
    expect(result.troughDate).toEqual(day(3));
  });

  it("takes the baseline day as the peak when the first return is a loss", () => {
    const result = calculateReturnDrawdown(series(["-0.05"]));

    expect(result.status).toBe("OK");
    expect(result.maxDrawdown?.toFixed(6)).toBe("-0.050000");
    expect(result.peakDate).toEqual(day(1));
    expect(result.troughDate).toEqual(day(2));
  });

  it("is zero, with no dates, on a rising index", () => {
    const result = calculateReturnDrawdown(series(["0.01", "0.02"]));

    expect(result.status).toBe("OK");
    expect(result.maxDrawdown?.isZero()).toBe(true);
    expect(result.currentDrawdown?.isZero()).toBe(true);
    expect(result.peakDate).toBeNull();
    expect(result.troughDate).toBeNull();
  });

  it("leaves the index unchanged on a day with no return", () => {
    // I = 1.00, 0.90, 0.90, 0.99
    const result = calculateReturnDrawdown(series(["-0.1", null, "0.1"]));

    expect(result.maxDrawdown?.toFixed(6)).toBe("-0.100000");
    expect(result.currentDrawdown?.toFixed(6)).toBe("-0.010000");
    expect(result.troughDate).toEqual(day(2));
  });

  it("is UNKNOWN with nulls, never 0, when no day has a return", () => {
    const expected = {
      status: "UNKNOWN",
      maxDrawdown: null,
      currentDrawdown: null,
      peakDate: null,
      troughDate: null,
    };

    expect(calculateReturnDrawdown([])).toEqual(expected);
    expect(calculateReturnDrawdown(series([null, null]))).toEqual(expected);
  });
});
