import { describe, expect, it } from "vitest";
import { LOG_EVENTS } from "./events.js";

describe("LOG_EVENTS", () => {
  const names = Object.values(LOG_EVENTS);

  it.each(names)("%s follows the dotted lowercase convention", (name) => {
    expect(name).toMatch(/^[a-z]+(\.[a-z]+(_[a-z]+)*)+$/);
  });

  it("has no duplicate name", () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses the ADR-009 names, not the earlier working names", () => {
    expect(names).toContain("http.request.failed");
    expect(names).toContain("auth.login.succeeded");
    expect(names).toContain("auth.login.failed");
    expect(names).not.toContain("request.failed");
    expect(names).not.toContain("auth.login.success");
    expect(names).not.toContain("auth.login.failure");
  });
});
