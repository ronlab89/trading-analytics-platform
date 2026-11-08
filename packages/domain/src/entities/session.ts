/**
 * Session entity: the server-side state of one refresh token.
 * Source: docs/05-data-model.md §5.3, ADR-005 points 5-6.
 *
 * The refresh token is an opaque value that never reaches this layer: a
 * session only holds its hash (`tokenHash`), computed by the caller. Every
 * refresh rotates the token into a new row of the same family (`familyId`);
 * presenting an already rotated token (`rotatedAt` set) is reuse and revokes
 * the whole family. `expiresAt` is the absolute lifetime of the family; the
 * idle timeout is not stored, it is `lastUsedAt` plus a configured duration.
 * A rotated row keeps its successor's refresh token encrypted in
 * `successorCiphertext` for the grace window, so a retried refresh gets the
 * same pair back; the caller encrypts it and clears it once the window ends.
 *
 * Pure domain type: no hashing algorithm, no clock and no I/O.
 */
export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly expiresAt: Date;
  readonly rotatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly successorCiphertext: string | null;
}

/**
 * The repository assigns `id`, `createdAt` and `lastUsedAt`; a new session
 * is neither rotated nor revoked and holds no successor.
 */
export type CreateSessionInput = Pick<Session, "userId" | "familyId" | "tokenHash" | "expiresAt">;

/**
 * Rotates a live session into `successor`, a new row of the same family and
 * user. `rotatedAt` is also the successor's `createdAt` and `lastUsedAt`.
 */
export interface RotateSessionInput {
  readonly sessionId: string;
  readonly rotatedAt: Date;
  readonly successor: CreateSessionInput;
  readonly successorCiphertext: string;
}

export class InvalidSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSessionError";
  }
}

/** Domain invariants for Session creation. */
export function validateNewSession(input: CreateSessionInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidSessionError("A userId is required.");
  }

  if (!input.familyId || input.familyId.trim().length === 0) {
    throw new InvalidSessionError("A familyId is required.");
  }

  if (!input.tokenHash || input.tokenHash.trim().length === 0) {
    throw new InvalidSessionError("A token hash is required.");
  }

  if (Number.isNaN(input.expiresAt.getTime())) {
    throw new InvalidSessionError("expiresAt must be a valid date.");
  }
}
