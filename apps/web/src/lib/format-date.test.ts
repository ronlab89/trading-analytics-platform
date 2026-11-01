import { describe, expect, it } from "vitest";
import { formatCalendarDay, formatDateTime } from "./format-date";

describe("formatDateTime", () => {
  it("writes the day, the short month and the 24-hour time, as the Figma does", () => {
    expect(formatDateTime("2026-10-06T14:29:00.000Z", "es", "UTC")).toBe("6 oct · 14:29");
  });

  it("writes September as sep, not sept", () => {
    expect(formatDateTime("2026-09-26T09:37:00.000Z", "es", "UTC")).toBe("26 sep · 09:37");
  });

  it("writes the month in the language of the person", () => {
    expect(formatDateTime("2026-10-06T14:29:00.000Z", "en", "UTC")).toBe("Oct 6 · 14:29");
  });

  it("writes the moment in the given time zone", () => {
    expect(formatDateTime("2026-10-06T14:29:00.000Z", "es", "America/Bogota")).toBe(
      "6 oct · 09:29",
    );
  });

  it("writes midnight as 00:00, not 24:00", () => {
    expect(formatDateTime("2026-11-01T00:00:00.000Z", "es", "UTC")).toBe("1 nov · 00:00");
  });
});

describe("formatCalendarDay", () => {
  it("writes the day, the short month and the year, in Spanish", () => {
    expect(formatCalendarDay("2026-10-14", "es")).toBe("14 oct 2026");
    expect(formatCalendarDay("2026-09-05", "es-AR")).toBe("5 sep 2026");
  });

  it("writes it in English for any other language", () => {
    expect(formatCalendarDay("2026-10-14", "en")).toBe("Oct 14, 2026");
    expect(formatCalendarDay("2026-10-14", "fr")).toBe("Oct 14, 2026");
  });

  it("does not move the day, whatever the time zone of the machine", () => {
    expect(formatCalendarDay("2026-01-01", "en")).toBe("Jan 1, 2026");
    expect(formatCalendarDay("2026-12-31", "en")).toBe("Dec 31, 2026");
  });

  it("gives back a text that is not a day as it is", () => {
    expect(formatCalendarDay("", "en")).toBe("");
    expect(formatCalendarDay("14/10/2026", "en")).toBe("14/10/2026");
  });
});
