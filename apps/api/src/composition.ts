import type { Clock } from "@trading/application";

/**
 * Composition root: the one place that builds concrete dependencies and
 * hands them to the use cases.
 * Source: ADR-001 point 4, 06-architecture.md §11.
 *
 * The system clock lives here, and only here, so application and domain
 * code never call `new Date()` (ADR-001 point 8). Each resource moved to
 * `@trading/application` adds its repositories and use cases below.
 */
export const systemClock: Clock = { now: () => new Date() };

export function buildComposition(clock: Clock) {
  return { clock };
}

export const composition = buildComposition(systemClock);
