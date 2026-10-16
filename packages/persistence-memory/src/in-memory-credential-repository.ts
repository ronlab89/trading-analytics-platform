import type { CreateCredentialInput, Credential, CredentialRepository } from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `CredentialRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: one credential per user (keyed by `userId`),
 * the password hash is stored exactly as received (hashing is the caller's
 * job), and `updatePasswordHash` throws when the user has no credential.
 * It cannot check that the user exists, since users live in another repository.
 */
export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly rows = new Map<string, Credential>();
  private readonly now: () => Date;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  getByUserId(userId: string): Promise<Credential | null> {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }

  create(input: CreateCredentialInput): Promise<Credential> {
    if (this.rows.has(input.userId)) {
      return Promise.reject(new Error(`User ${input.userId} already has a credential.`));
    }

    const timestamp = this.now();
    const credential: Credential = {
      userId: input.userId,
      passwordHash: input.passwordHash,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.rows.set(credential.userId, credential);

    return Promise.resolve(credential);
  }

  updatePasswordHash(userId: string, passwordHash: string): Promise<Credential> {
    const existing = this.rows.get(userId);

    if (!existing) {
      return Promise.reject(new Error(`User ${userId} has no credential.`));
    }

    const updated: Credential = { ...existing, passwordHash, updatedAt: this.now() };
    this.rows.set(userId, updated);

    return Promise.resolve(updated);
  }
}
