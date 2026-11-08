import { describe, expect, it } from "vitest";
import { logLevelForMode } from "@/lib/logging/logger";

describe("logLevelForMode", () => {
  it.each([
    ["development", "debug"],
    ["production", "info"],
    ["test", "silent"],
    ["staging", "info"],
  ])("maps the %s mode to the %s level", (mode, level) => {
    expect(logLevelForMode(mode)).toBe(level);
  });
});
