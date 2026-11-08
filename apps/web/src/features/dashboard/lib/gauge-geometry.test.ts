import { describe, expect, it } from "vitest";
import { gaugeArcPath, gaugeSegments, pointOnGauge } from "./gauge-geometry";

const center = { x: 100, y: 100 };

describe("pointOnGauge", () => {
  it("puts 180 degrees at the left end, 90 at the top and 0 at the right end", () => {
    expect(pointOnGauge(center, 80, 180).x).toBeCloseTo(20, 10);
    expect(pointOnGauge(center, 80, 180).y).toBeCloseTo(100, 10);
    expect(pointOnGauge(center, 80, 90).x).toBeCloseTo(100, 10);
    expect(pointOnGauge(center, 80, 90).y).toBeCloseTo(20, 10);
    expect(pointOnGauge(center, 80, 0).x).toBeCloseTo(180, 10);
  });
});

describe("gaugeArcPath", () => {
  it("draws a clockwise arc between the two angles", () => {
    expect(gaugeArcPath(center, 80, 180, 90)).toBe("M 20 100 A 80 80 0 0 1 100 20");
  });
});

describe("gaugeSegments", () => {
  it("splits the half circle in equal parts, left to right", () => {
    const segments = gaugeSegments(3, 0);

    expect(segments.map((s) => [s.from, s.to])).toEqual([
      [180, 120],
      [120, 60],
      [60, 0],
    ]);
    expect(segments.map((s) => s.middle)).toEqual([150, 90, 30]);
  });

  it("leaves a gap between neighbours but not at the ends", () => {
    const [first, second, third] = gaugeSegments(3, 4);

    expect(first?.from).toBe(180);
    expect(first?.to).toBe(122);
    expect(second?.from).toBe(118);
    expect(second?.to).toBe(62);
    expect(third?.from).toBe(58);
    expect(third?.to).toBe(0);
  });
});
