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
