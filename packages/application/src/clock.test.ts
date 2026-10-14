import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock.js";

describe("fixedClock", () => {
  it("always returns the configured instant", () => {
    const clock = fixedClock(new Date("2026-10-13T12:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-10-13T12:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-10-13T12:00:00.000Z");
  });

  it("returns a copy, so callers cannot move the clock by mutating the result", () => {
    const clock = fixedClock(new Date("2026-10-13T12:00:00.000Z"));
    clock.now().setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe("2026-10-13T12:00:00.000Z");
  });

  it("does not follow later changes to the date it was built from", () => {
    const source = new Date("2026-10-13T12:00:00.000Z");
    const clock = fixedClock(source);
    source.setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe("2026-10-13T12:00:00.000Z");
  });
});
