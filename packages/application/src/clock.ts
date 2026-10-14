/**
 * The only way application and domain code learns the time.
 * Source: ADR-001 point 8.
 *
 * Production wires the system clock in the composition root; the
 * realtime simulator reuses the same port (ADR-007 point 7); tests pass
 * `fixedClock`. Nothing in this package calls `new Date()` itself.
 */
export interface Clock {
  now(): Date;
}

/** A clock frozen at one instant, for tests. Each `now()` returns a fresh copy. */
export function fixedClock(instant: Date): Clock {
  const time = instant.getTime();
  return { now: () => new Date(time) };
}
