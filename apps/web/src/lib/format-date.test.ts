import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format-date";

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
