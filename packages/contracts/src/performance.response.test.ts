import { describe, expect, it } from "vitest";
import { Decimal, Money } from "@trading/domain";
import { performanceResponseSchema, presentPerformance } from "./performance.response.js";

const asOf = new Date(Date.UTC(2026, 2, 3));
const effectiveFrom = new Date(Date.UTC(2026, 2, 1));

describe("presentPerformance", () => {
  it("presents returns as percentage points, money as strings and dates as UTC dates", () => {
    // TWR = 1.10 x 0.9 - 1 = -1%
    const performance = presentPerformance({
      asOf,
      effectiveFrom,
      status: "OK",
      twr: new Decimal("-0.01"),
      pnl: Money.of("16", "USD"),
      series: [
        { date: effectiveFrom, value: Money.of("100", "USD"), returnRate: null },
        {
          date: new Date(Date.UTC(2026, 2, 2)),
          value: Money.of("110", "USD"),
          returnRate: new Decimal("0.1"),
        },
        { date: asOf, value: Money.of("99", "USD"), returnRate: new Decimal("-0.1") },
      ],
    });

    expect(performanceResponseSchema.parse(performance)).toEqual({
      asOf: "2026-03-03",
      effectiveFrom: "2026-03-01",
      status: "OK",
      twrPercent: -1,
      pnl: { amount: "16", currency: "USD" },
      series: [
        { date: "2026-03-01", value: { amount: "100", currency: "USD" }, returnPercent: null },
        { date: "2026-03-02", value: { amount: "110", currency: "USD" }, returnPercent: 10 },
        { date: "2026-03-03", value: { amount: "99", currency: "USD" }, returnPercent: -10 },
      ],
    });
  });

  it("presents unavailable values as null, never 0", () => {
    const performance = presentPerformance({
      asOf,
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      twr: null,
      pnl: null,
      series: [],
    });

    expect(performanceResponseSchema.parse(performance)).toEqual({
      asOf: "2026-03-03",
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      twrPercent: null,
      pnl: null,
      series: [],
    });
  });

  it("keeps a day without a value as null", () => {
    const performance = presentPerformance({
      asOf,
      effectiveFrom,
      status: "OK",
      twr: null,
      pnl: Money.zero("USD"),
      series: [{ date: effectiveFrom, value: null, returnRate: null }],
    });

    expect(performance.series[0]).toEqual({
      date: "2026-03-01",
      value: null,
      returnPercent: null,
    });
  });
});
