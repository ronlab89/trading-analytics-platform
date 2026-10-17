/**
 * UTC calendar-day helpers shared by the period and series calculations.
 * Day boundaries are UTC calendar dates everywhere (ADR-004). Internal to
 * `calculations/`: not exported from the package index.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The same instant truncated to 00:00:00.000 UTC. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
