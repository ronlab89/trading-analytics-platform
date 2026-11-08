import type { PerformancePeriod } from "@/features/dashboard/hooks/use-performance";

/** What the Analytics view asks for: a preset period, or two calendar days (`YYYY-MM-DD`, both included). */
export type AnalyticsPeriod =
  { kind: "preset"; period: PerformancePeriod } | { kind: "custom"; from: string; to: string };

/** The API's own default, and the one the Figma opens on. */
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = { kind: "preset", period: "1M" };

/** The query of the period-based endpoints: `period`, or `from` and `to`, never both. */
export function toPeriodQuery(
  period: AnalyticsPeriod,
): { period: PerformancePeriod } | { from: string; to: string } {
  return period.kind === "preset"
    ? { period: period.period }
    : { from: period.from, to: period.to };
}

/** A stable text for the period, so it can be part of a query key. */
export function periodKey(period: AnalyticsPeriod): string {
  return period.kind === "preset" ? period.period : `${period.from}..${period.to}`;
}
