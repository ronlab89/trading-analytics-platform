import type { CreateSessionInput, RotateSessionInput, Session } from "../entities/session";

/**
 * Session repository contract.
 * Source: docs/05-data-model.md §5.3, ADR-005 points 5-6.
 *
 * Sessions hold refresh-token state. The token itself is never accepted or
 * returned: callers hash it first and look sessions up by that hash.
 * Time always comes from the caller, so the grace window is testable.
 */
export interface SessionRepository {
  /**
   * Creates a session for a freshly issued refresh token. Callers are
   * expected to have run `validateNewSession`. `tokenHash` is unique: a
   * duplicate rejects.
   */
  create(input: CreateSessionInput): Promise<Session>;

  /** Returns the session whose refresh token hashes to `tokenHash`, or null. */
  getByTokenHash(tokenHash: string): Promise<Session | null>;

  /**
   * Atomically marks the session rotated and creates its successor, which
   * is returned. Resolves null, changing nothing, when the session is
   * already rotated or revoked (or does not exist), so of two concurrent
   * refreshes only one wins.
   */
  rotate(input: RotateSessionInput): Promise<Session | null>;

  /**
   * Revokes every session of the family not yet revoked and drops their
   * stored successor tokens, since a revoked family has no grace window;
   * none is deleted.
   */
  revokeFamily(familyId: string, revokedAt: Date): Promise<void>;

  /**
   * Drops the stored successor token of every session of the family rotated
   * before `rotatedBefore`: their grace window has ended.
   */
  clearExpiredSuccessors(familyId: string, rotatedBefore: Date): Promise<void>;
}
