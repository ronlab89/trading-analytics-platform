import { describe, expect, it } from "vitest";
import {
  alertIdParamsSchema,
  portfolioIdParamsSchema,
  portfolioScenarioParamsSchema,
  resourceIdSchema,
} from "./params.schema.js";

describe("route parameter schemas", () => {
  it.each(["a", "does-not-exist", "clx_9Zy-1", "a".repeat(64)])("accepts %s", (id) => {
    expect(resourceIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["", "a".repeat(65), "bad id", "../x", "a%00", "a/b", "caf\u00e9"])(
    "rejects %j",
    (id) => {
      expect(resourceIdSchema.safeParse(id).success).toBe(false);
    },
  );

  it("names the failing parameter in the issue path", () => {
    const result = portfolioScenarioParamsSchema.safeParse({
      portfolioId: "ok",
      scenarioId: "bad id",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(["scenarioId"]);
    expect(portfolioIdParamsSchema.safeParse({ portfolioId: "ok" }).success).toBe(true);
    expect(alertIdParamsSchema.safeParse({}).success).toBe(false);
  });
});
