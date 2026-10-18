import jwt from "jsonwebtoken";
import type { Clock } from "@trading/application";
import { UserRole } from "@trading/domain";
import { AppError } from "../errors/app-error.js";

export interface TokenServiceOptions {
  secret: string;
  /** Lifetime of an access token; 900 (15 minutes) in production. */
  ttlSeconds: number;
  clock: Clock;
}

export interface TokenClaims {
  userId: string;
  role: UserRole;
}

export interface AccessToken {
  accessToken: string;
  expiresAt: Date;
}

export interface TokenService {
  issue(claims: TokenClaims): AccessToken;
  /** Throws the generic 401 for every failure, never revealing which one. */
  verify(token: string): TokenClaims;
}

const ALGORITHM = "HS256";

function isUserRole(role: string): role is UserRole {
  return (Object.values(UserRole) as string[]).includes(role);
}

/**
 * Signs and verifies the access token.
 * Source: 09-security-spec.md §6, ADR-005 points 4 and 8.
 *
 * Time comes from the injected `Clock`, never from the system, so expiry is
 * testable without waiting. The payload carries only `sub` and `role`. The
 * algorithm is pinned to HS256 on verification, so a token signed with
 * another algorithm, or none, is rejected. A token whose role is not a
 * `UserRole` (such as an old `USER`) is rejected with the same generic 401.
 */
export function createTokenService(options: TokenServiceOptions): TokenService {
  const { secret, ttlSeconds, clock } = options;
  const unauthorized = () => new AppError("UNAUTHORIZED", "Authentication required.", 401);

  return {
    issue({ userId, role }) {
      const issuedAt = Math.floor(clock.now().getTime() / 1000);
      const expiresAtSeconds = issuedAt + ttlSeconds;
      const accessToken = jwt.sign(
        { sub: userId, role, iat: issuedAt, exp: expiresAtSeconds },
        secret,
        {
          algorithm: ALGORITHM,
        },
      );

      return { accessToken, expiresAt: new Date(expiresAtSeconds * 1000) };
    },

    verify(token) {
      let payload: unknown;
      try {
        payload = jwt.verify(token, secret, {
          algorithms: [ALGORITHM],
          clockTimestamp: Math.floor(clock.now().getTime() / 1000),
        });
      } catch {
        throw unauthorized();
      }

      if (typeof payload !== "object" || payload === null) {
        throw unauthorized();
      }
      const { sub, role } = payload as Record<string, unknown>;
      if (typeof sub !== "string" || typeof role !== "string" || !isUserRole(role)) {
        throw unauthorized();
      }

      return { userId: sub, role };
    },
  };
}
