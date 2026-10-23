/**
 * Seeded pseudo-random generator.
 * Source: ADR-007 point 7, 08-realtime-spec.md §36 and §39.
 *
 * The same seed always yields the same sequence, so a simulation is repeatable (NFR-045).
 * The engine never reads an unseeded source such as `Math.random()`.
 */
export interface Random {
  /** The next value, uniform in [0, 1). */
  next(): number;
  /** The next value of a standard normal distribution (mean 0, standard deviation 1). */
  nextGaussian(): number;
}

/** Hashes a seed string to an unsigned 32-bit integer (FNV-1a). */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A seed is a string or an integer; a string is hashed so any text is a valid seed. */
export function createRandom(seed: string | number): Random {
  let state = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;

  // mulberry32: a small generator with a 32-bit state and good statistical quality.
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  // Box-Muller transform. `1 - next()` is in (0, 1], so the logarithm is always finite.
  const nextGaussian = (): number => {
    const radius = Math.sqrt(-2 * Math.log(1 - next()));
    const angle = 2 * Math.PI * next();
    return radius * Math.cos(angle);
  };

  return { next, nextGaussian };
}
