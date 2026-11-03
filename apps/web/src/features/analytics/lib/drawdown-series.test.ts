import { describe, expect, it } from "vitest";
import { summarizeDrawdown, toDrawdownSeries } from "./drawdown-series";

const day = (date: string, returnPercent: number | null) => ({
  date,
  value: { amount: "100.00", currency: "USD" },
  returnPercent,
});

describe("toDrawdownSeries", () => {
  it("is zero while the portfolio only goes up", () => {
    const points = toDrawdownSeries([
      day("2026-10-01", null),
      day("2026-10-02", 2),
      day("2026-10-03", 1),
    ]);

    expect(points?.map((point) => point.drawdown)).toEqual([0, 0, 0]);
  });

  it("measures each day against the highest the cumulative index has been", () => {
    // Index: 1, 1.10, 0.99 (a 10% fall from 1.10), 1.089 (a 10% rise, still 1% under the high).
    const points = toDrawdownSeries([
      day("2026-10-01", null),
      day("2026-10-02", 10),
      day("2026-10-03", -10),
      day("2026-10-04", 10),
    ]);

    expect(points?.map((point) => Number(point.drawdown.toFixed(4)))).toEqual([0, 0, -10, -1]);
  });

  it("goes back to zero when the index makes a new high", () => {
    const points = toDrawdownSeries([
      day("2026-10-01", null),
      day("2026-10-02", -5),
      day("2026-10-03", 10),
    ]);

    expect(points?.[1]?.drawdown).toBeCloseTo(-5, 6);
    expect(points?.[2]?.drawdown).toBe(0);
  });

  it("leaves the index where it was on a day without a return", () => {
    const points = toDrawdownSeries([
      day("2026-10-01", null),
      day("2026-10-02", -4),
      day("2026-10-03", null),
    ]);

    expect(points?.[2]?.drawdown).toBeCloseTo(-4, 6);
  });

  it("keeps the dates of the series", () => {
    const points = toDrawdownSeries([day("2026-10-01", null), day("2026-10-02", 1)]);

    expect(points?.map((point) => point.date)).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("has nothing to draw with fewer than two days", () => {
    expect(toDrawdownSeries([])).toBeNull();
    expect(toDrawdownSeries([day("2026-10-01", null)])).toBeNull();
  });
});

describe("summarizeDrawdown", () => {
  it("finds the deepest day and the end of the period", () => {
    const summary = summarizeDrawdown([
      { date: "2026-10-01", drawdown: 0 },
      { date: "2026-10-02", drawdown: -8.4 },
      { date: "2026-10-03", drawdown: -3 },
    ]);

    expect(summary.deepest).toEqual({ date: "2026-10-02", drawdown: -8.4 });
    expect(summary.end).toEqual({ date: "2026-10-03", drawdown: -3 });
  });

  it("takes the first of two equally deep days", () => {
    const summary = summarizeDrawdown([
      { date: "2026-10-01", drawdown: -2 },
      { date: "2026-10-02", drawdown: -2 },
    ]);

    expect(summary.deepest.date).toBe("2026-10-01");
  });
});
