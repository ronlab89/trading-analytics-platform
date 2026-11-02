export interface Point {
  x: number;
  y: number;
}

/**
 * A point of a half circle that opens upwards, by its angle in degrees: 180 is the left end, 90
 * the top and 0 the right end. The y axis of an SVG grows downwards, so it is flipped here.
 */
export function pointOnGauge(center: Point, radius: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center.x + radius * Math.cos(radians),
    y: center.y - radius * Math.sin(radians),
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The SVG path of an arc on that half circle, from `fromDegrees` to `toDegrees` going clockwise. */
export function gaugeArcPath(
  center: Point,
  radius: number,
  fromDegrees: number,
  toDegrees: number,
): string {
  const start = pointOnGauge(center, radius, fromDegrees);
  const end = pointOnGauge(center, radius, toDegrees);
  const largeArc = Math.abs(fromDegrees - toDegrees) > 180 ? 1 : 0;
  return `M ${String(round(start.x))} ${String(round(start.y))} A ${String(radius)} ${String(radius)} 0 ${String(largeArc)} 1 ${String(round(end.x))} ${String(round(end.y))}`;
}

export interface GaugeSegment {
  /** Where the arc starts and ends, in degrees on the half circle (180 is the left end). */
  from: number;
  to: number;
  /** The middle of the arc, where the needle points when this is the active segment. */
  middle: number;
}

/**
 * The `count` equal segments of the half circle, left to right, with a gap between each pair so
 * they read as separate steps.
 */
export function gaugeSegments(count: number, gapDegrees: number): GaugeSegment[] {
  const span = 180 / count;
  return Array.from({ length: count }, (_, index) => {
    const start = 180 - index * span;
    const end = start - span;
    return {
      from: index === 0 ? start : start - gapDegrees / 2,
      to: index === count - 1 ? end : end + gapDegrees / 2,
      middle: start - span / 2,
    };
  });
}
