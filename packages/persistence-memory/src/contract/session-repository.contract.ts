import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SessionRepository } from "@trading/domain";

export interface SessionContractContext {
  readonly repository: SessionRepository;
  readonly fixtures: {
    /** An existing user that owns the sessions created by the suite. */
    readonly userId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `SessionRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * The token hashes are fake strings: hashing is the caller's job, so the
 * repository must keep whatever it receives exactly as received.
 */
export function sessionRepositoryContract(
  name: string,
  factory: () => Promise<SessionContractContext>,
): void {
  describe(`${name} (SessionRepository contract)`, () => {
    let context: SessionContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const expiresAt = new Date("2026-11-17T00:00:00.000Z");
    const input = (tokenHash = "hash-1", familyId = "family-1") => ({
      userId: context.fixtures.userId,
      familyId,
      tokenHash,
      expiresAt,
    });

    it("returns null for a token hash that was never stored", async () => {
      expect(await context.repository.getByTokenHash("unknown")).toBeNull();
    });

    it("creates a live session: stored as received, never rotated or revoked", async () => {
      const created = await context.repository.create(input());

      expect(created).toMatchObject({ ...input(), rotatedAt: null, revokedAt: null });
      expect(created.id).toEqual(expect.any(String));
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.lastUsedAt).toEqual(created.createdAt);
      expect(created.expiresAt).toEqual(expiresAt);
    });

    it("finds a session by its token hash and returns null for another hash", async () => {
      const created = await context.repository.create(input());

      expect(await context.repository.getByTokenHash("hash-1")).toEqual(created);
      expect(await context.repository.getByTokenHash("hash-2")).toBeNull();
    });

    it("gives every session its own id, also within the same family", async () => {
      const first = await context.repository.create(input("hash-1"));
      const second = await context.repository.create(input("hash-2"));

      expect(second.id).not.toBe(first.id);
      expect(second.familyId).toBe(first.familyId);
      expect(await context.repository.getByTokenHash("hash-2")).toEqual(second);
    });

    it("rejects a second session with the same token hash", async () => {
      await context.repository.create(input());

      await expect(context.repository.create(input("hash-1", "family-2"))).rejects.toThrow();
    });
  });
}
