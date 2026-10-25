import { describe, expect, it } from "vitest";
import { createRandom } from "./random.js";

function take(count: number, seed: string | number): number[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random.next());
}

describe("createRandom", () => {
  it("produces the same sequence for the same seed", () => {
    expect(take(20, "seed-a")).toEqual(take(20, "seed-a"));
    expect(take(20, 42)).toEqual(take(20, 42));
  });

  it("produces a different sequence for a different seed", () => {
    expect(take(20, "seed-a")).not.toEqual(take(20, "seed-b"));
    expect(take(20, 1)).not.toEqual(take(20, 2));
  });

  it("keeps every value in [0, 1)", () => {
    for (const value of take(5000, "range")) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("is uniform enough: the mean of many values is near 0.5", () => {
    const values = take(20000, "uniform");
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });

  it("produces the same gaussian sequence for the same seed", () => {
    const first = createRandom("gauss");
    const second = createRandom("gauss");
    for (let index = 0; index < 20; index += 1) {
      expect(first.nextGaussian()).toBe(second.nextGaussian());
    }
  });

  it("produces gaussian values with mean near 0 and deviation near 1", () => {
    const random = createRandom("gauss-stats");
    const values = Array.from({ length: 20000 }, () => random.nextGaussian());
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.sqrt(variance)).toBeGreaterThan(0.97);
    expect(Math.sqrt(variance)).toBeLessThan(1.03);
  });

  it("never returns a non-finite gaussian value", () => {
    const random = createRandom(0);
    for (let index = 0; index < 5000; index += 1) {
      expect(Number.isFinite(random.nextGaussian())).toBe(true);
    }
  });
});
