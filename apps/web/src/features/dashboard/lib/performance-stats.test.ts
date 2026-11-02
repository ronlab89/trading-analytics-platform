import { describe, expect, it } from "vitest";
import { dailyStats, monthlyReturns, type PerformancePoint } from "./performance-stats";

function point(date: string, returnPercent: number | null): PerformancePoint {
  return { date, value: null, returnPercent };
}

describe("dailyStats", () => {
  it("is null when no day has a return", () => {
    expect(dailyStats([])).toBeNull();
    expect(dailyStats([point("2026-10-01", null)])).toBeNull();
  });

  it("finds the best and the worst day", () => {
    const stats = dailyStats([
      point("2026-10-01", 0.5),
      point("2026-10-02", -1.2),
      point("2026-10-03", 2.1),
    ]);

    expect(stats?.best).toEqual({ date: "2026-10-03", percent: 2.1 });
    expect(stats?.worst).toEqual({ date: "2026-10-02", percent: -1.2 });
  });

  it("works out the share of positive days and the daily average, ignoring days without a return", () => {
    const stats = dailyStats([
      point("2026-10-01", 1),
      point("2026-10-02", null),
      point("2026-10-03", -1),
      point("2026-10-04", 2),
      point("2026-10-05", 0),
    ]);

    expect(stats?.positiveDaysPercent).toBe(50);
    expect(stats?.averagePercent).toBe(0.5);
  });

  it("counts the current streak back from the last day", () => {
    const up = dailyStats([point("a", -1), point("b", 1), point("c", 0.2), point("d", 3)]);
    const down = dailyStats([point("a", 1), point("b", -0.4), point("c", -3)]);

    expect(up?.streak).toEqual({ direction: "up", days: 3 });
    expect(down?.streak).toEqual({ direction: "down", days: 2 });
  });

  it("calls the streak flat when the last day did not move", () => {
    expect(dailyStats([point("a", 1), point("b", 0)])?.streak).toEqual({
      direction: "flat",
      days: 1,
    });
  });
});

describe("monthlyReturns", () => {
  it("is empty without a series", () => {
    expect(monthlyReturns([])).toEqual([]);
  });

  it("compounds the daily returns of each month, in order", () => {
    const months = monthlyReturns([
      point("2026-09-29", 10),
      point("2026-09-30", 10),
      point("2026-10-01", -10),
      point("2026-10-02", null),
      point("2026-10-03", -10),
    ]);

    expect(months.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    expect(months[0]?.percent).toBeCloseTo(21, 10);
    expect(months[1]?.percent).toBeCloseTo(-19, 10);
  });
});
