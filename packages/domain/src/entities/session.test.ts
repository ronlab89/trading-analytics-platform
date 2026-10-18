import { describe, expect, it } from "vitest";
import { InvalidSessionError, validateNewSession } from "./session";

const valid = {
  userId: "user_123",
  familyId: "family_1",
  tokenHash: "a1b2c3d4",
  expiresAt: new Date("2026-11-17T00:00:00Z"),
};

describe("validateNewSession", () => {
  it("should accept a valid session input", () => {
    expect(() => {
      validateNewSession(valid);
    }).not.toThrow();
  });

  it.each([
    ["userId", { userId: "" }],
    ["userId", { userId: "   " }],
    ["familyId", { familyId: "" }],
    ["token hash", { tokenHash: "" }],
    ["token hash", { tokenHash: "   " }],
    ["expiresAt", { expiresAt: new Date("not a date") }],
  ])("should reject a missing or invalid %s", (_field, override) => {
    expect(() => {
      validateNewSession({ ...valid, ...override });
    }).toThrow(InvalidSessionError);
  });
});
