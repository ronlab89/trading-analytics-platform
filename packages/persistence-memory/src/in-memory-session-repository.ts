import type { CreateSessionInput, Session, SessionRepository } from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `SessionRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: `id` is assigned here, `createdAt` and
 * `lastUsedAt` start at the same instant, a new session is neither rotated
 * nor revoked, and `tokenHash` is unique and kept exactly as received (the
 * caller hashes the refresh token). It cannot check that the user exists,
 * since users live in another repository.
 */
export class InMemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, Session>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  create(input: CreateSessionInput): Promise<Session> {
    if ([...this.rows.values()].some((session) => session.tokenHash === input.tokenHash)) {
      return Promise.reject(new Error("A session with this token hash already exists."));
    }

    const timestamp = this.now();
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
    };
    this.rows.set(session.id, session);

    return Promise.resolve(session);
  }

  getByTokenHash(tokenHash: string): Promise<Session | null> {
    const found = [...this.rows.values()].find((session) => session.tokenHash === tokenHash);

    return Promise.resolve(found ?? null);
  }
}
