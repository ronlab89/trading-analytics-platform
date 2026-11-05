const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
/** How much of a delay the jitter may take off, so a delay never goes over the cap (docs/08 §27). */
const JITTER_RATIO = 0.25;

/**
 * How long to wait before reconnection attempt number `attempt` (the first one is 1): 1 s doubling
 * each time up to 30 s, with a random part taken off so that many clients that lost the server
 * together do not come back together. `random` returns a number in [0, 1) and is replaceable in tests.
 */
export function nextReconnectDelay(attempt: number, random: () => number = Math.random): number {
  const exponent = Math.max(attempt, 1) - 1;
  const base = Math.min(INITIAL_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
  return Math.round(base * (1 - JITTER_RATIO * random()));
}
