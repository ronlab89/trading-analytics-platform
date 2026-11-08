import { describe, expect, it } from "vitest";
import { assertNotProduction } from "./seed-guard.js";

describe("assertNotProduction", () => {
  it.each(["development", "test", undefined, ""])("allows NODE_ENV=%s", (nodeEnv) => {
    expect(() => {
      assertNotProduction("seed", { NODE_ENV: nodeEnv });
    }).not.toThrow();
  });

  it("refuses when NODE_ENV=production and names the operation", () => {
    expect(() => {
      assertNotProduction("seed", { NODE_ENV: "production" });
    }).toThrow(/seed.*production/i);
    expect(() => {
      assertNotProduction("reset", { NODE_ENV: "production" });
    }).toThrow(/reset.*production/i);
  });
});
