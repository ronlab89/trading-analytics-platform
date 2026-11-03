import type { TFunction } from "i18next";
import { formatCalendarRange } from "@/lib/format-date";
import type { AnalyticsPeriod } from "./analytics-period";

/** The period as the KPI notes write it: `1M` for a preset, `1 oct – 14 oct` for a custom range. */
export function periodLabel(period: AnalyticsPeriod, t: TFunction, language: string): string {
  return period.kind === "preset"
    ? t(`analytics.period.presets.${period.period}`)
    : formatCalendarRange(period.from, period.to, language);
}
