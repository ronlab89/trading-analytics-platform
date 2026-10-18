import type {
  CreateSessionInput,
  RotateSessionInput,
  Session,
  SessionRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `SessionRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: `id` is assigned here, `createdAt` and
 * `lastUsedAt` start at the same instant, a new session is neither rotated
 * nor revoked, and `tokenHash` is unique and kept exactly as received (the
 * caller hashes the refresh token). It cannot check that the user exists,
 * since users live in another repository. Every method runs synchronously
 * inside its promise, so `rotate` is atomic like the Prisma transaction.
 */
export class InMemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, Session>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  create(input: CreateSessionInput): Promise<Session> {
    if (this.hashTaken(input.tokenHash)) {
      return Promise.reject(new Error("A session with this token hash already exists."));
    }

    return Promise.resolve(this.insert(input, this.now()));
  }

  rotate(input: RotateSessionInput): Promise<Session | null> {
    const current = this.rows.get(input.sessionId);

    if (!current || current.rotatedAt || current.revokedAt) {
      return Promise.resolve(null);
    }

    if (this.hashTaken(input.successor.tokenHash)) {
      return Promise.reject(new Error("A session with this token hash already exists."));
    }

    this.rows.set(current.id, {
      ...current,
      rotatedAt: input.rotatedAt,
      successorCiphertext: input.successorCiphertext,
    });

    return Promise.resolve(this.insert(input.successor, input.rotatedAt));
  }

  revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    for (const session of this.rows.values()) {
      if (session.familyId === familyId && !session.revokedAt) {
        this.rows.set(session.id, { ...session, revokedAt, successorCiphertext: null });
      }
    }

    return Promise.resolve();
  }

  clearExpiredSuccessors(familyId: string, rotatedBefore: Date): Promise<void> {
    for (const session of this.rows.values()) {
      if (
        session.familyId === familyId &&
        session.rotatedAt &&
        session.rotatedAt.getTime() < rotatedBefore.getTime()
      ) {
        this.rows.set(session.id, { ...session, successorCiphertext: null });
      }
    }

    return Promise.resolve();
  }

  getByTokenHash(tokenHash: string): Promise<Session | null> {
    const found = [...this.rows.values()].find((session) => session.tokenHash === tokenHash);

    return Promise.resolve(found ?? null);
  }

  private hashTaken(tokenHash: string): boolean {
    return [...this.rows.values()].some((session) => session.tokenHash === tokenHash);
  }

  private insert(input: CreateSessionInput, timestamp: Date): Session {
    const session: Session = {
      id: `session_${String(++this.sequence)}`,
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      createdAt: timestamp,
      lastUsedAt: timestamp,
      expiresAt: input.expiresAt,
      rotatedAt: null,
      revokedAt: null,
      successorCiphertext: null,
    };
    this.rows.set(session.id, session);

    return session;
  }
}
