import type { DrawdownPoint } from "./drawdown-series";

/** The smallest depth the axis shows, so a portfolio that never fell still draws a scale. */
const MIN_DEPTH = 2;

/**
 * The three guides of the drawdown chart, from the top (0) to the bottom: 0, half the depth and
 * the depth, where the depth is the deepest drawdown rounded out to an even number of points so
 * the middle guide is a whole number (`-8.4` gives `0, -5, -10`; no fall gives `0, -1, -2`).
 */
export function drawdownTicks(points: readonly DrawdownPoint[]): [number, number, number] {
  let deepest = 0;
  for (const { drawdown } of points) {
    if (drawdown < deepest) deepest = drawdown;
  }
  const depth = Math.max(MIN_DEPTH, Math.ceil(Math.abs(deepest) / 2) * 2);
  return [0, -depth / 2, -depth];
}
