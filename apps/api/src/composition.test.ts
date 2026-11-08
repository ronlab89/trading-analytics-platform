import { describe, expect, it } from "vitest";
import { fixedClock } from "@trading/application";
import { buildComposition, composition, systemClock } from "./composition.js";

describe("composition root", () => {
  it("the system clock reads the real time", () => {
    const before = Date.now();
    const read = systemClock.now().getTime();
    expect(read).toBeGreaterThanOrEqual(before);
    expect(read).toBeLessThanOrEqual(Date.now());
  });

  it("builds on an injected clock, so tests can freeze time", () => {
    const frozen = fixedClock(new Date("2026-10-13T12:00:00.000Z"));
    expect(buildComposition(frozen).clock.now().toISOString()).toBe("2026-10-13T12:00:00.000Z");
  });

  it("the default composition uses the system clock", () => {
    expect(composition.clock).toBe(systemClock);
  });
});
