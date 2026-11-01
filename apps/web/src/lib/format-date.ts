/**
 * Like the numbers (`format-number.ts`), the dates use a fixed locale until the language selection
 * decides how to format by the active language.
 */
const LOCALE = "en-US";

const formats = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormat(timeZone: string | undefined) {
  const key = timeZone ?? "";
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    });
    formats.set(key, format);
  }
  return format;
}

/**
 * A moment as the person reads it: date and time in their own time zone (`Oct 31, 2026, 14:05`).
 * The API sends an ISO 8601 instant. `timeZone` exists so a test does not depend on the machine
 * that runs it; the views never pass it.
 */
export function formatDateTime(iso: string, timeZone?: string): string {
  return dateTimeFormat(timeZone).format(new Date(iso));
}
