import { describe, expect, it } from "vitest";
import { InvalidUserPreferenceError, validateNewUserPreference } from "./user-preference";

const baseInput = {
  userId: "user_001",
  theme: "dark",
  language: "en",
};

describe("validateNewUserPreference", () => {
  it("should accept a valid preference input", () => {
    expect(() => {
      validateNewUserPreference(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing userId", () => {
    expect(() => {
      validateNewUserPreference({ ...baseInput, userId: "" });
    }).toThrow(InvalidUserPreferenceError);
  });

  it("should reject a missing theme", () => {
    expect(() => {
      validateNewUserPreference({ ...baseInput, theme: "" });
    }).toThrow(InvalidUserPreferenceError);
  });

  it("should reject a missing language", () => {
    expect(() => {
      validateNewUserPreference({ ...baseInput, language: "" });
    }).toThrow(InvalidUserPreferenceError);
  });
});
