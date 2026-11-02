/**
 * The month names follow the active language, so a date is written in it. Spanish uses the Mexican
 * locale because it abbreviates September as "sep", the way the Figma draws it ("26 sep"); the
 * default Spanish one writes "sept". Any other language writes English.
 */
function localeOf(language: string) {
  return language.startsWith("es") ? "es-MX" : "en-US";
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();
const timeFormats = new Map<string, Intl.DateTimeFormat>();

function cached(
  cache: Map<string, Intl.DateTimeFormat>,
  locale: string,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  const key = `${locale}:${timeZone ?? ""}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    cache.set(key, format);
  }
  return format;
}

/**
 * A moment as the Figma writes it: the day and the short month, a dot and the 24-hour time, in the
 * person's own time zone (`6 oct · 14:29`, `Oct 6 · 14:29`). The API sends an ISO 8601 instant and
 * the year is left out, as in the design. `timeZone` exists so a test does not depend on the
 * machine that runs it; the views never pass it.
 */
export function formatDateTime(iso: string, language: string, timeZone?: string): string {
  const locale = localeOf(language);
  const moment = new Date(iso);
  const day = cached(dayFormats, locale, timeZone, { day: "numeric", month: "short" });
  const time = cached(timeFormats, locale, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${day.format(moment)} · ${time.format(moment)}`;
}

const fullDayFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A moment with its year, for the detail of one transaction (`6 oct 2026, 14:29`, `Oct 6, 2026,
 * 14:29`): the list leaves the year out, the detail has the room to say it.
 */
export function formatFullDateTime(iso: string, language: string, timeZone?: string): string {
  const locale = localeOf(language);
  const moment = new Date(iso);
  const day = cached(fullDayFormats, locale, timeZone, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = cached(timeFormats, locale, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${day.format(moment)}, ${time.format(moment)}`;
}

const calendarDayFormats = new Map<string, Intl.DateTimeFormat>();
const dayMonthFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A calendar day (`2026-10-14`, what a date input holds) as the Figma writes it: day, short month
 * and year (`14 oct 2026`, `Oct 14, 2026`). It has no time zone: the day is read as written, so it
 * never moves to the day before or after. A text that is not a day comes back as it is.
 */
export function formatCalendarDay(day: string, language: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return day;
  return cached(calendarDayFormats, localeOf(language), "UTC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Two calendar days as the Figma filter chip writes them (`1 oct – 14 oct`). The year is left out
 * while both ends are in the current year and written on both ends otherwise, so a range of 2025
 * is never mistaken for this year's. `today` exists so a test does not depend on the date it runs.
 */
export function formatCalendarRange(
  from: string,
  to: string,
  language: string,
  today: Date = new Date(),
): string {
  const year = String(today.getFullYear());
  if (!from.startsWith(year) || !to.startsWith(year)) {
    return `${formatCalendarDay(from, language)} – ${formatCalendarDay(to, language)}`;
  }
  const format = cached(dayMonthFormats, localeOf(language), "UTC", {
    day: "numeric",
    month: "short",
  });
  const write = (day: string) => {
    const [y = 0, m = 0, d = 0] = day.split("-").map(Number);
    return format.format(new Date(Date.UTC(y, m - 1, d)));
  };
  return `${write(from)} – ${write(to)}`;
}

/** A calendar day without its year, as a chart axis writes it (`28 sep`, `Sep 28`). */
export function formatDayMonth(day: string, language: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return day;
  return cached(dayMonthFormats, localeOf(language), "UTC", {
    day: "numeric",
    month: "short",
  }).format(date);
}

const shortMonthFormats = new Map<string, Intl.DateTimeFormat>();

/** A month (`2026-10`) as its short name, for the label under a monthly bar (`oct`, `Oct`). */
export function formatShortMonth(month: string, language: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  if (Number.isNaN(date.getTime())) return month;
  return cached(shortMonthFormats, localeOf(language), "UTC", { month: "short" }).format(date);
}

const longDayFormats = new Map<string, Intl.DateTimeFormat>();
const secondsFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A day with its weekday and month in full, for the dashboard header (`Lunes, 6 de octubre`,
 * `Monday, October 6`). Spanish writes the weekday in lower case, so the first letter is raised to
 * start the line the way the Figma does.
 */
export function formatLongDate(iso: string, language: string, timeZone?: string): string {
  const text = cached(longDayFormats, localeOf(language), timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The time of day to the second in 24 hours (`14:32:07`), for "Actualizado 14:32:07". */
export function formatTimeOfDay(iso: string, language: string, timeZone?: string): string {
  return cached(secondsFormats, localeOf(language), timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

/**
 * How long ago a moment was, in the largest whole unit (`2 days ago`, `3 hr. ago`, `now`), for the
 * line under a notification. `now` exists so a test does not depend on the time it runs. A text
 * that is not a date comes back as it is.
 */
export function formatRelativeTime(iso: string, language: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const locale = localeOf(language);
  let format = relativeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
    relativeFormats.set(locale, format);
  }
  const seconds = Math.trunc((then - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return format.format(0, "second");
  if (abs < 3600) return format.format(Math.trunc(seconds / 60), "minute");
  if (abs < 86400) return format.format(Math.trunc(seconds / 3600), "hour");
  return format.format(Math.trunc(seconds / 86400), "day");
}
