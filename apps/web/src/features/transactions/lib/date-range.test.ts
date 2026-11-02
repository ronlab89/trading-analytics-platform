import { describe, expect, it } from "vitest";
import { fromCalendarDay, matchingPreset, presetRange, toCalendarDay } from "./date-range";

const today = new Date(2026, 9, 14, 15, 30);

describe("toCalendarDay and fromCalendarDay", () => {
  it("write a day as the user's calendar has it, whatever the time of day", () => {
    expect(toCalendarDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toCalendarDay(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });

  it("read it back as the start of that day", () => {
    expect(fromCalendarDay("2026-10-14")).toEqual(new Date(2026, 9, 14, 0, 0, 0, 0));
  });
});

describe("presetRange", () => {
  it("counts the last days with today as the last of them", () => {
    expect(presetRange("last7", today)).toEqual({ from: "2026-10-08", to: "2026-10-14" });
    expect(presetRange("last30", today)).toEqual({ from: "2026-09-15", to: "2026-10-14" });
    expect(presetRange("last90", today)).toEqual({ from: "2026-07-17", to: "2026-10-14" });
  });

  it("starts this year on the first of January", () => {
    expect(presetRange("thisYear", today)).toEqual({ from: "2026-01-01", to: "2026-10-14" });
  });

  it("crosses a month and a year boundary", () => {
    expect(presetRange("last7", new Date(2026, 0, 3))).toEqual({
      from: "2025-12-28",
      to: "2026-01-03",
    });
  });
});

describe("matchingPreset", () => {
  it("names the preset a range was built from", () => {
    expect(matchingPreset(presetRange("last30", today), today)).toBe("last30");
    expect(matchingPreset(presetRange("thisYear", today), today)).toBe("thisYear");
  });

  it("is null for any other range, which the panel calls custom", () => {
    expect(matchingPreset({ from: "2026-10-01", to: "2026-10-14" }, today)).toBeNull();
    expect(matchingPreset(null, today)).toBeNull();
  });
});
