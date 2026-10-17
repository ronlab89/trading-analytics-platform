import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { DailyFlow } from "./daily-return";
import { calculatePeriodPerformance } from "./period-performance";
import type { DailyValue } from "./value-series";

const day = (n: number) => new Date(Date.UTC(2026, 2, n));
const usd = (amount: string) => Money.of(amount, "USD");

const priced = (n: number, amount: string): DailyValue => ({
  date: day(n),
  value: usd(amount),
  status: "OK",
});
const unpriced = (n: number): DailyValue => ({
  date: day(n),
  value: null,
  status: "INSUFFICIENT_DATA",
});
const flow = (n: number, bought = "0", sold = "0"): DailyFlow => ({
  date: day(n),
  bought: usd(bought),
  sold: usd(sold),
});

/**
 * The worked example of docs/16-analytics-spec.md §7:
 *   d1: BUY 10 @ 10, fees 1   close 10.5   V = 105   B = 101   S = 0
 *   d2: no trade              close 11     V = 110
 *   d3: SELL 4 @ 11.5, fees 1 close 12     V = 72    B = 0     S = 45
 * with d0 as the empty day before the first trade.
 */
const flows = [flow(0), flow(1, "101"), flow(2), flow(3, "0", "45")];
const fullSeries = [priced(0, "0"), priced(1, "105"), priced(2, "110"), priced(3, "72")];

describe("calculatePeriodPerformance", () => {
  it("should measure an unclamped period from the close before it", () => {
    const result = calculatePeriodPerformance(fullSeries, flows, "USD");

    expect(result.status).toBe("OK");
    expect(result.effectiveFrom).toEqual(day(1));
    // (105/101) x (110/105) x (117/110) - 1 = 117/101 - 1.
    expect(result.twr?.toFixed(8)).toBe("0.15841584");
    // 72 - 0 - (101 - 45) = 16.
    expect(result.pnl?.toString()).toBe("16");
    expect(result.returns.map((point) => point.date)).toEqual([day(1), day(2), day(3)]);
    expect(result.returns.map((point) => point.rate?.toFixed(6))).toEqual([
      "0.039604",
      "0.047619",
      "0.063636",
    ]);
  });

  it("should use only the days after the baseline for a later period", () => {
    const result = calculatePeriodPerformance(fullSeries.slice(1), flows.slice(1), "USD");

    expect(result.effectiveFrom).toEqual(day(2));
    // (110/105) x (117/110) - 1 = 117/105 - 1.
    expect(result.twr?.toFixed(8)).toBe("0.11428571");
    // 72 - 105 - (0 - 45) = 12.
    expect(result.pnl?.toString()).toBe("12");
  });

  it("should clamp to the first day from which every held asset has a price", () => {
    // Period [d1, d3] with no price before d2: effectiveFrom = d2.
    const series = [unpriced(0), unpriced(1), priced(2, "110"), priced(3, "72")];
    const result = calculatePeriodPerformance(series, flows, "USD");

    expect(result.status).toBe("OK");
    expect(result.effectiveFrom).toEqual(day(2));
    // Only r(d3) counts: 117/110 - 1.
    expect(result.twr?.toFixed(8)).toBe("0.06363636");
    // 72 - 110 - (0 - 45) = 7.
    expect(result.pnl?.toString()).toBe("7");
    expect(result.returns.map((point) => point.date)).toEqual([day(3)]);
  });

  it("should leave out the flows of the effective first day", () => {
    const series = [unpriced(0), unpriced(1), priced(2, "110"), priced(3, "72")];
    const withBuy = [flow(0), flow(1), flow(2, "50"), flow(3, "0", "45")];

    expect(calculatePeriodPerformance(series, withBuy, "USD").pnl?.toString()).toBe("7");
  });

  it("should clamp to the first day when only the day before it has no price", () => {
    const series = [unpriced(0), priced(1, "105"), priced(2, "110"), priced(3, "72")];
    const result = calculatePeriodPerformance(series, flows, "USD");

    expect(result.effectiveFrom).toEqual(day(1));
    // Baseline V(d1) = 105: 72 - 105 - (0 - 45) = 12.
    expect(result.pnl?.toString()).toBe("12");
  });

  it("should state the end as the effective start when a single priced day remains", () => {
    const series = [unpriced(0), unpriced(1), unpriced(2), priced(3, "72")];
    const result = calculatePeriodPerformance(series, flows, "USD");

    expect(result.status).toBe("OK");
    expect(result.effectiveFrom).toEqual(day(3));
    expect(result.twr).toBeNull();
    expect(result.pnl?.toString()).toBe("0");
    expect(result.returns).toEqual([]);
  });

  it("should report insufficient data, with no values, when the last day has no price", () => {
    const series = [priced(0, "0"), priced(1, "105"), priced(2, "110"), unpriced(3)];
    const result = calculatePeriodPerformance(series, flows, "USD");

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.effectiveFrom).toBeNull();
    expect(result.twr).toBeNull();
    expect(result.pnl).toBeNull();
  });

  it("should give no TWR but a zero P/L for an empty portfolio throughout", () => {
    const series = [priced(0, "0"), priced(1, "0"), priced(2, "0")];
    const result = calculatePeriodPerformance(series, [flow(0), flow(1), flow(2)], "USD");

    expect(result.status).toBe("OK");
    expect(result.twr).toBeNull();
    expect(result.pnl?.toString()).toBe("0");
    expect(result.returns.map((point) => point.rate)).toEqual([null, null]);
  });

  it("should treat an empty series as an empty portfolio", () => {
    const result = calculatePeriodPerformance([], [], "USD");

    expect(result).toEqual({
      status: "OK",
      effectiveFrom: null,
      twr: null,
      pnl: Money.zero("USD"),
      returns: [],
    });
  });

  it("should throw when values and flows do not cover the same days", () => {
    expect(() => calculatePeriodPerformance(fullSeries, flows.slice(1), "USD")).toThrow(RangeError);
  });
});
