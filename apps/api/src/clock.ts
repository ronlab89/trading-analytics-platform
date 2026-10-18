import type { Clock } from "@trading/application";

/**
 * The system clock: the only place the API reads real time (ADR-001 point 8).
 *
 * Kept apart from `composition.ts`, which builds the repositories, so code
 * that only needs the time (such as the access token service) does not load
 * the database client.
 */
export const systemClock: Clock = { now: () => new Date() };
