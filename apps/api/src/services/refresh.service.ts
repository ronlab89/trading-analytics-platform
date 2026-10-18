import {
  validateNewSession,
  type Session,
  type SessionRepository,
  type UserRepository,
  type UserRole,
} from "@trading/domain";
import type { Clock } from "@trading/application";
import { AppError } from "../errors/app-error.js";
import type { GraceTokenCipher } from "./grace-token-cipher.js";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token.js";
import type { TokenService } from "./token.service.js";

/** How long a just-rotated token keeps returning the same new pair. */
export const REFRESH_GRACE_SECONDS = 10;

export interface RefreshServiceOptions {
  sessions: SessionRepository;
  users: Pick<UserRepository, "getById">;
  accessTokens: TokenService;
  graceCipher: GraceTokenCipher;
  clock: Clock;
  /** A session unused for this long is dead, whatever its absolute lifetime. */
  idleSeconds: number;
  graceSeconds?: number;
}

export interface RefreshResult {
  user: { id: string; email: string; displayName: string; role: UserRole };
  accessToken: string;
  expiresAt: Date;
  /** The opaque refresh token; only its hash is stored. Sent as a cookie, never in the body. */
  refreshToken: string;
}

export interface RefreshService {
  refresh(refreshToken: string | undefined): Promise<RefreshResult>;
}

/**
 * Rotates a refresh token into a new access and refresh pair.
 * Source: ADR-005 points 5-7, 09-security-spec.md §7.
 *
 * Every use of a live token rotates it. A rotated token presented again
 * inside the grace window gets the same successor back, which covers two
 * parallel refreshes and a response lost on the way; outside the window it is
 * reuse, and the whole family is revoked. Every rejection is the same generic
 * 401, so a caller cannot tell an unknown token from an expired or revoked
 * one.
 */
export function createRefreshService(options: RefreshServiceOptions): RefreshService {
  const { sessions, users, accessTokens, graceCipher, clock, idleSeconds } = options;
  const graceMs = (options.graceSeconds ?? REFRESH_GRACE_SECONDS) * 1000;

  const reject = (): never => {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token.", 401);
  };

  const isDead = (session: Session, now: Date): boolean =>
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= now.getTime() ||
    session.lastUsedAt.getTime() + idleSeconds * 1000 <= now.getTime();

  /** The token was already rotated: replay the successor inside the window, else it is reuse. */
  async function replay(session: Session, rotatedAt: Date, now: Date): Promise<string> {
    const insideWindow = now.getTime() - rotatedAt.getTime() < graceMs;
    const successor =
      insideWindow && session.successorCiphertext
        ? graceCipher.decrypt(session.successorCiphertext)
        : null;

    if (successor !== null) {
      return successor;
    }

    if (!insideWindow) {
      await sessions.revokeFamily(session.familyId, now);
      await sessions.clearSuccessorCiphertext(session.id);
    }
    return reject();
  }

  return {
    async refresh(refreshToken) {
      if (!refreshToken) {
        return reject();
      }

      const now = clock.now();
      const tokenHash = hashRefreshToken(refreshToken);
      const session = await sessions.getByTokenHash(tokenHash);

      if (!session || isDead(session, now)) {
        return reject();
      }

      let successorToken: string;

      if (session.rotatedAt) {
        successorToken = await replay(session, session.rotatedAt, now);
      } else {
        const next = generateRefreshToken();
        const successor = {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: hashRefreshToken(next),
          expiresAt: session.expiresAt,
        };
        validateNewSession(successor);

        const rotated = await sessions.rotate({
          sessionId: session.id,
          rotatedAt: now,
          successor,
          successorCiphertext: graceCipher.encrypt(next),
        });

        if (rotated) {
          successorToken = next;
        } else {
          // Another refresh rotated this token first: this one is a replay inside the window.
          const winner = await sessions.getByTokenHash(tokenHash);

          if (!winner?.rotatedAt || isDead(winner, now)) {
            return reject();
          }
          successorToken = await replay(winner, winner.rotatedAt, now);
        }
      }

      const user = await users.getById(session.userId);

      if (!user) {
        return reject();
      }

      const { accessToken, expiresAt } = accessTokens.issue({ userId: user.id, role: user.role });

      return {
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
        accessToken,
        expiresAt,
        refreshToken: successorToken,
      };
    },
  };
}
