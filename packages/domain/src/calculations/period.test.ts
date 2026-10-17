import { describe, expect, it } from "vitest";
import { PRESET_PERIODS, resolvePeriodWindow } from "./period";

/** A UTC calendar date, as `YYYY-MM-DD`. */
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

function window(period: Parameters<typeof resolvePeriodWindow>[0], to: string, earliest?: string) {
  const result = resolvePeriodWindow(
    period,
    utc(to),
    earliest === undefined ? null : utc(earliest),
  );
  return result === null
    ? null
    : {
        anchor: result.anchor.toISOString().slice(0, 10),
        from: result.from.toISOString().slice(0, 10),
      };
}

describe("resolvePeriodWindow", () => {
  it("should list the presets of docs/16-analytics-spec.md §8", () => {
    expect(PRESET_PERIODS).toEqual(["1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"]);
  });

  it("should count 1W as 7 days ending on `to`", () => {
    expect(window("1W", "2026-03-31")).toEqual({ anchor: "2026-03-24", from: "2026-03-25" });
  });

  it("should clamp 1M to the last day of a shorter month", () => {
    expect(window("1M", "2026-03-31")).toEqual({ anchor: "2026-02-28", from: "2026-03-01" });
    expect(window("1M", "2026-03-30")).toEqual({ anchor: "2026-02-28", from: "2026-03-01" });
  });

  it("should use the leap day when the previous February has one", () => {
    expect(window("1M", "2024-03-31")).toEqual({ anchor: "2024-02-29", from: "2024-03-01" });
  });

  it("should give 3M the same days as YTD when `to` is 31 March", () => {
    expect(window("3M", "2026-03-31")).toEqual({ anchor: "2025-12-31", from: "2026-01-01" });
    expect(window("YTD", "2026-03-31")).toEqual({ anchor: "2025-12-31", from: "2026-01-01" });
  });

  it("should clamp 3M and 6M to the end of February", () => {
    expect(window("3M", "2026-05-31")).toEqual({ anchor: "2026-02-28", from: "2026-03-01" });
    expect(window("6M", "2026-08-31")).toEqual({ anchor: "2026-02-28", from: "2026-03-01" });
  });

  it("should move 1Y from a leap day to 28 February of the previous year", () => {
    expect(window("1Y", "2028-02-29")).toEqual({ anchor: "2027-02-28", from: "2027-03-01" });
  });

  it("should cross a year boundary", () => {
    expect(window("1W", "2026-01-03")).toEqual({ anchor: "2025-12-27", from: "2025-12-28" });
    expect(window("1M", "2026-01-15")).toEqual({ anchor: "2025-12-15", from: "2025-12-16" });
  });

  it("should start YTD on 1 January of the year of `to`", () => {
    expect(window("YTD", "2026-01-01")).toEqual({ anchor: "2025-12-31", from: "2026-01-01" });
    expect(window("YTD", "2026-09-17")).toEqual({ anchor: "2025-12-31", from: "2026-01-01" });
  });

  it("should treat a `to` with a time of day as that UTC date", () => {
    const result = resolvePeriodWindow("1W", new Date("2026-03-31T18:45:00Z"), null);

    expect(result?.from).toEqual(utc("2026-03-25"));
    expect(result?.anchor).toEqual(utc("2026-03-24"));
  });

  it("should start ALL on the UTC date of the earliest transaction", () => {
    const result = resolvePeriodWindow("ALL", utc("2026-03-31"), new Date("2026-02-10T15:30:00Z"));

    expect(result?.from).toEqual(utc("2026-02-10"));
    expect(result?.anchor).toEqual(utc("2026-02-09"));
  });

  it("should return null for ALL when there is no transaction", () => {
    expect(window("ALL", "2026-03-31")).toBeNull();
  });

  it("should not mutate its inputs", () => {
    const to = utc("2026-03-31");
    const earliest = utc("2026-01-05");

    resolvePeriodWindow("ALL", to, earliest);
    resolvePeriodWindow("1M", to, earliest);

    expect(to).toEqual(utc("2026-03-31"));
    expect(earliest).toEqual(utc("2026-01-05"));
  });
});
