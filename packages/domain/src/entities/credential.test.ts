import { describe, expect, it } from "vitest";
import { InvalidCredentialError, validateNewCredential } from "./credential";

describe("validateNewCredential", () => {
  it("should accept a valid credential input", () => {
    expect(() => {
      validateNewCredential({
        userId: "user_123",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
      });
    }).not.toThrow();
  });

  it("should reject a missing userId", () => {
    expect(() => {
      validateNewCredential({
        userId: "",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
      });
    }).toThrow(InvalidCredentialError);
  });

  it("should reject a missing password hash", () => {
    expect(() => {
      validateNewCredential({
        userId: "user_123",
        passwordHash: "",
      });
    }).toThrow(InvalidCredentialError);
  });

  it("should reject a whitespace-only password hash", () => {
    expect(() => {
      validateNewCredential({
        userId: "user_123",
        passwordHash: "   ",
      });
    }).toThrow(InvalidCredentialError);
  });
});
