import { describe, expect, it } from "vitest";
import { UserRole } from "@trading/domain";
import { createTokenService } from "../services/token.service.js";
import { createAccessTokenAuthenticator } from "./access-token-authenticator.js";

const now = new Date("2026-10-21T10:00:00.000Z");
const tokens = createTokenService({
  secret: "authenticator-test-secret-authenticator-test-secret",
  ttlSeconds: 900,
  clock: { now: () => now },
});
const authenticate = createAccessTokenAuthenticator(tokens);

describe("access token authenticator", () => {
  it("returns the user, the role and the expiry of a valid token", () => {
    const { accessToken } = tokens.issue({ userId: "u1", role: UserRole.TRADER });

    expect(authenticate(accessToken)).toEqual({
      userId: "u1",
      role: UserRole.TRADER,
      expiresAt: new Date("2026-10-21T10:15:00.000Z"),
    });
  });

  it("throws for a token that is not valid", () => {
    expect(() => authenticate("not-a-token")).toThrow();
  });

  it("throws for an expired token", () => {
    const { accessToken } = tokens.issue({ userId: "u1", role: UserRole.TRADER });
    const later = createAccessTokenAuthenticator(
      createTokenService({
        secret: "authenticator-test-secret-authenticator-test-secret",
        ttlSeconds: 900,
        clock: { now: () => new Date("2026-10-21T10:15:01.000Z") },
      }),
    );

    expect(() => later(accessToken)).toThrow();
  });
});
