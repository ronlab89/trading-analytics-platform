import { describe, expect, it } from "vitest";
import { nextReconnectDelay } from "./reconnect-backoff";

const withoutJitter = () => 0;
const maximumJitter = () => 0.999999;

describe("nextReconnectDelay", () => {
  it("doubles from 1 s on each attempt", () => {
    const delays = [1, 2, 3, 4, 5].map((attempt) => nextReconnectDelay(attempt, withoutJitter));

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
  });

  it("never goes over 30 s however many attempts there are", () => {
    expect(nextReconnectDelay(6, withoutJitter)).toBe(30_000);
    expect(nextReconnectDelay(50, withoutJitter)).toBe(30_000);
  });

  it("takes at most a quarter off a delay and never adds to it", () => {
    expect(nextReconnectDelay(3, maximumJitter)).toBeGreaterThanOrEqual(3_000);
    expect(nextReconnectDelay(3, maximumJitter)).toBeLessThanOrEqual(4_000);
    expect(nextReconnectDelay(10, maximumJitter)).toBeLessThanOrEqual(30_000);
  });

  it("gives different delays for different random values", () => {
    expect(nextReconnectDelay(4, () => 0.1)).not.toBe(nextReconnectDelay(4, () => 0.9));
  });

  it("treats an attempt below 1 as the first one", () => {
    expect(nextReconnectDelay(0, withoutJitter)).toBe(1_000);
  });
});
