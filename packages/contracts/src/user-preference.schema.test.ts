import { describe, expect, it } from "vitest";
import { updateUserPreferenceRequestSchema } from "./user-preference.schema.js";

describe("updateUserPreferenceRequestSchema theme and language", () => {
  it.each(["light", "dark", "system"])("accepts theme %s", (theme) => {
    expect(updateUserPreferenceRequestSchema.safeParse({ theme }).success).toBe(true);
  });

  it.each(["en", "es"])("accepts language %s", (language) => {
    expect(updateUserPreferenceRequestSchema.safeParse({ language }).success).toBe(true);
  });

  it.each(["midnight", "DARK", ""])("rejects theme %j with a theme field issue", (theme) => {
    const result = updateUserPreferenceRequestSchema.safeParse({ theme });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(["theme"]);
  });

  it.each(["fr", "EN", "en-US", ""])(
    "rejects language %j with a language field issue",
    (language) => {
      const result = updateUserPreferenceRequestSchema.safeParse({ language });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(["language"]);
    },
  );

  it("still requires at least one field", () => {
    expect(updateUserPreferenceRequestSchema.safeParse({}).success).toBe(false);
  });
});
