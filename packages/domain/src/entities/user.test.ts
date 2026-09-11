import { describe, expect, it } from "vitest";
import { InvalidUserError, validateNewUser } from "./user";

describe("validateNewUser", () => {
  it("should accept a valid user input", () => {
    expect(() => {
      validateNewUser({
        email: "trader@example.com",
        displayName: "Demo Trader",
      });
    }).not.toThrow();
  });

  it("should reject a missing email", () => {
    expect(() => {
      validateNewUser({
        email: "",
        displayName: "Demo Trader",
      });
    }).toThrow(InvalidUserError);
  });

  it("should reject a malformed email", () => {
    expect(() => {
      validateNewUser({
        email: "not-an-email",
        displayName: "Demo Trader",
      });
    }).toThrow(InvalidUserError);
  });

  it("should reject an empty display name", () => {
    expect(() => {
      validateNewUser({
        email: "trader@example.com",
        displayName: "   ",
      });
    }).toThrow(InvalidUserError);
  });
});
