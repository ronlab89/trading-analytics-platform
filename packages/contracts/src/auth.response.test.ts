import { describe, expect, it } from "vitest";
import { loginResponseSchema, presentLogin } from "./auth.response.js";

const result = {
  user: { id: "u1", email: "a@b.c", displayName: "Ana", role: "TRADER" as const },
  accessToken: "access.jwt.token",
  expiresAt: new Date("2026-10-18T12:15:00.000Z"),
};

describe("login presenter", () => {
  it("returns the user and the session with an ISO expiry", () => {
    const dto = presentLogin(result);

    expect(dto).toEqual({
      user: { id: "u1", email: "a@b.c", displayName: "Ana", role: "TRADER" },
      session: { accessToken: "access.jwt.token", expiresAt: "2026-10-18T12:15:00.000Z" },
    });
    expect(loginResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const dto = presentLogin({
      ...result,
      user: { ...result.user, passwordHash: "secret" },
      refreshToken: "refresh",
    } as typeof result);

    expect(Object.keys(dto).sort()).toEqual(["session", "user"]);
    expect(Object.keys(dto.user).sort()).toEqual(["displayName", "email", "id", "role"]);
    expect(Object.keys(dto.session).sort()).toEqual(["accessToken", "expiresAt"]);
  });

  it("rejects a role outside the role set", () => {
    const dto = presentLogin(result);

    expect(
      loginResponseSchema.safeParse({ ...dto, user: { ...dto.user, role: "USER" } }).success,
    ).toBe(false);
  });
});
