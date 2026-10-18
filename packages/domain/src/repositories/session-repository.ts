import type { CreateSessionInput, Session } from "../entities/session";

/**
 * Session repository contract.
 * Source: docs/05-data-model.md §5.3, ADR-005 points 5-6.
 *
 * Sessions hold refresh-token state. The token itself is never accepted or
 * returned: callers hash it first and look sessions up by that hash.
 * Rotation, reuse detection and revocation arrive with the refresh and
 * logout endpoints (B2.4).
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
}
