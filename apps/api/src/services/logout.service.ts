import type { Clock } from "@trading/application";
import type { SessionRepository } from "@trading/domain";
import { hashRefreshToken } from "./refresh-token.js";

export interface LogoutServiceOptions {
  sessions: SessionRepository;
  clock: Clock;
}

export interface LogoutService {
  logout(refreshToken: string | undefined): Promise<void>;
}

/**
 * Ends the session behind a refresh token by revoking its whole family, so
 * the token and every successor stop working (FR-003, ADR-005).
 *
 * Logout never fails on the token: a missing, unknown, expired or already
 * revoked one has nothing left to end, and the caller clears the cookie
 * either way. An access token already issued stays valid until it expires,
 * at most 15 minutes.
 */
export function createLogoutService(options: LogoutServiceOptions): LogoutService {
  const { sessions, clock } = options;

  return {
    async logout(refreshToken) {
      if (!refreshToken) {
        return;
      }

      const session = await sessions.getByTokenHash(hashRefreshToken(refreshToken));

      if (session) {
        await sessions.revokeFamily(session.familyId, clock.now());
      }
    },
  };
}
