import { describe, expect, it } from "vitest";
import { validateLogin } from "./validate-login";

describe("validateLogin", () => {
  it("accepts a valid email and a password", () => {
    expect(validateLogin({ email: "jane@example.com", password: "secret" })).toEqual({});
  });

  it.each(["", "jane", "jane@", "jane@correo", "jane @example.com"])(
    "rejects the email %j",
    (email) => {
      expect(validateLogin({ email, password: "secret" })).toEqual({ email: true });
    },
  );

  it("rejects an empty password", () => {
    expect(validateLogin({ email: "jane@example.com", password: "" })).toEqual({ password: true });
  });

  it("reports both fields when both are wrong", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({ email: true, password: true });
  });

  it("does not trim the password: a space is a character", () => {
    expect(validateLogin({ email: "jane@example.com", password: " " })).toEqual({});
  });
});
