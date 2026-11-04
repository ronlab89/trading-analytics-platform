import { describe, expect, it } from "vitest";
import {
  formatCalendarDay,
  formatCalendarRange,
  formatDayMonth,
  formatDateTime,
  formatFullDateTime,
  formatLongDate,
  formatMomentDay,
  formatMomentFullDay,
  formatRelativeTime,
  formatShortMonth,
  formatTimeOfDay,
} from "./format-date";

describe("formatLongDate", () => {
  it("writes the weekday, the day and the month in full, as the dashboard header does", () => {
    expect(formatLongDate("2026-10-06T14:29:00.000Z", "es", "UTC")).toBe("Martes, 6 de octubre");
    expect(formatLongDate("2026-10-06T14:29:00.000Z", "en", "UTC")).toBe("Tuesday, October 6");
  });

  it("writes the day in the given time zone", () => {
    expect(formatLongDate("2026-10-07T02:00:00.000Z", "es", "America/Bogota")).toBe(
      "Martes, 6 de octubre",
    );
  });
});

describe("formatTimeOfDay", () => {
  it("writes the 24-hour time with seconds, as the dashboard's 'Actualizado' does", () => {
    expect(formatTimeOfDay("2026-10-06T14:32:07.000Z", "es", "UTC")).toBe("14:32:07");
  });

  it("writes midnight as 00:00:00, not 24:00:00", () => {
    expect(formatTimeOfDay("2026-10-06T00:00:00.000Z", "en", "UTC")).toBe("00:00:00");
  });
});

describe("formatFullDateTime", () => {
  it("adds the year to the day, as the Figma detail does", () => {
    expect(formatFullDateTime("2026-10-06T14:29:00.000Z", "es", "UTC")).toBe("6 oct 2026, 14:29");
  });

  it("writes the month in the language of the person", () => {
    expect(formatFullDateTime("2026-10-06T14:29:00.000Z", "en", "UTC")).toBe("Oct 6, 2026, 14:29");
  });

  it("writes the moment in the given time zone", () => {
    expect(formatFullDateTime("2026-10-06T14:29:00.000Z", "es", "America/Bogota")).toBe(
      "6 oct 2026, 09:29",
    );
  });
});

describe("formatMomentDay", () => {
  it("writes the day and the short month, with no time", () => {
    expect(formatMomentDay("2026-10-06T14:29:00.000Z", "es", "UTC")).toBe("6 oct");
    expect(formatMomentDay("2026-10-06T14:29:00.000Z", "en", "UTC")).toBe("Oct 6");
  });

  it("writes the day in the given time zone", () => {
    expect(formatMomentDay("2026-10-07T02:00:00.000Z", "es", "America/Bogota")).toBe("6 oct");
  });
});

describe("formatMomentFullDay", () => {
  it("adds the year to the day", () => {
    expect(formatMomentFullDay("2026-10-06T14:29:00.000Z", "es", "UTC")).toBe("6 oct 2026");
    expect(formatMomentFullDay("2026-10-06T14:29:00.000Z", "en", "UTC")).toBe("Oct 6, 2026");
  });

  it("writes the day in the given time zone", () => {
    expect(formatMomentFullDay("2026-10-07T02:00:00.000Z", "es", "America/Bogota")).toBe(
      "6 oct 2026",
    );
  });
});

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

describe("formatCalendarRange", () => {
  const today = new Date(2026, 9, 20);

  it("leaves the year out when both ends are in the current year, as the Figma chip does", () => {
    expect(formatCalendarRange("2026-10-01", "2026-10-14", "es", today)).toBe("1 oct – 14 oct");
    expect(formatCalendarRange("2026-10-01", "2026-10-14", "en", today)).toBe("Oct 1 – Oct 14");
  });

  it("writes the year of both ends when either is not in the current year", () => {
    expect(formatCalendarRange("2025-12-20", "2026-01-05", "es", today)).toBe(
      "20 dic 2025 – 5 ene 2026",
    );
    expect(formatCalendarRange("2025-03-01", "2025-03-31", "en", today)).toBe(
      "Mar 1, 2025 – Mar 31, 2025",
    );
  });
});

describe("formatDayMonth", () => {
  it("writes the day and the short month without the year", () => {
    expect(formatDayMonth("2026-09-28", "en")).toBe("Sep 28");
    expect(formatDayMonth("2026-09-28", "es")).toBe("28 sep");
  });

  it("returns a text that is not a day as it is", () => {
    expect(formatDayMonth("soon", "en")).toBe("soon");
  });
});

describe("formatShortMonth", () => {
  it("writes the short name of the month", () => {
    expect(formatShortMonth("2026-10", "en")).toBe("Oct");
    expect(formatShortMonth("2026-10", "es").toLowerCase()).toContain("oct");
  });

  it("returns a text that is not a month as it is", () => {
    expect(formatShortMonth("soon", "en")).toBe("soon");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");

  it("writes how long ago in the largest whole unit", () => {
    expect(formatRelativeTime("2026-10-04T12:00:00.000Z", "en", now)).toBe("2 days ago");
    expect(formatRelativeTime("2026-10-06T09:00:00.000Z", "en", now)).toBe("3 hr. ago");
    expect(formatRelativeTime("2026-10-06T11:55:00.000Z", "en", now)).toBe("5 min. ago");
  });

  it("says now for less than a minute", () => {
    expect(formatRelativeTime("2026-10-06T11:59:30.000Z", "en", now)).toBe("now");
  });

  it("writes it in the language of the user", () => {
    expect(formatRelativeTime("2026-10-03T12:00:00.000Z", "es", now)).toContain("3");
    expect(formatRelativeTime("2026-10-03T12:00:00.000Z", "es", now)).not.toContain("ago");
  });

  it("returns a text that is not a date as it is", () => {
    expect(formatRelativeTime("soon", "en", now)).toBe("soon");
  });
});
