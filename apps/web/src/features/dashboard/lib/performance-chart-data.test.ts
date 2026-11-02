import { describe, expect, it } from "vitest";
import { summarizeSeries, toValueSeries } from "./performance-chart-data";
import type { PerformancePoint } from "./performance-stats";

function point(date: string, amount: string | null): PerformancePoint {
  return {
    date,
    value: amount === null ? null : { amount, currency: "USD" },
    returnPercent: null,
  };
}

describe("toValueSeries", () => {
  it("is null when there are fewer than two days with a value, so there is no line to draw", () => {
    expect(toValueSeries([])).toBeNull();
    expect(toValueSeries([point("2026-10-01", "100.00"), point("2026-10-02", null)])).toBeNull();
  });

  it("keeps the days with a value as numbers and takes the currency from them", () => {
    const series = toValueSeries([
      point("2026-10-01", "100.50"),
      point("2026-10-02", null),
      point("2026-10-03", "110.25"),
    ]);

    expect(series).toEqual({
      currency: "USD",
      points: [
        { date: "2026-10-01", value: 100.5 },
        { date: "2026-10-03", value: 110.25 },
      ],
    });
  });
});

describe("summarizeSeries", () => {
  it("gives the first and last day, the highest and lowest value and the change in between", () => {
    const summary = summarizeSeries([
      { date: "2026-10-01", value: 100 },
      { date: "2026-10-02", value: 120 },
      { date: "2026-10-03", value: 90 },
      { date: "2026-10-04", value: 110 },
    ]);

    expect(summary.start).toEqual({ date: "2026-10-01", value: 100 });
    expect(summary.end).toEqual({ date: "2026-10-04", value: 110 });
    expect(summary.high.value).toBe(120);
    expect(summary.low.value).toBe(90);
    expect(summary.changePercent).toBeCloseTo(10, 10);
  });
});
