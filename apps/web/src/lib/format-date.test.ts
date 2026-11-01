import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format-date";

describe("formatDateTime", () => {
  it("writes the date and the 24-hour time", () => {
    expect(formatDateTime("2026-10-31T14:05:00.000Z", "UTC")).toBe("Oct 31, 2026, 14:05");
  });

  it("writes the moment in the given time zone", () => {
    expect(formatDateTime("2026-10-31T14:05:00.000Z", "America/Bogota")).toBe(
      "Oct 31, 2026, 09:05",
    );
  });

  it("writes midnight as 00:00, not 24:00", () => {
    expect(formatDateTime("2026-11-01T00:00:00.000Z", "UTC")).toBe("Nov 1, 2026, 00:00");
  });
});
