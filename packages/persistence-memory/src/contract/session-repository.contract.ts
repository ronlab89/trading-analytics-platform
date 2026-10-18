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

      expect(created).toMatchObject({
        ...input(),
        rotatedAt: null,
        revokedAt: null,
        successorCiphertext: null,
      });
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

    describe("rotate", () => {
      const rotatedAt = new Date("2026-10-18T12:00:00.000Z");
      const rotation = (sessionId: string, successorHash = "hash-2") => ({
        sessionId,
        rotatedAt,
        successor: input(successorHash),
        successorCiphertext: "cipher-1",
      });

      it("marks the session rotated, keeps its ciphertext and returns the live successor", async () => {
        const first = await context.repository.create(input());

        const successor = await context.repository.rotate(rotation(first.id));

        expect(successor).toMatchObject({
          ...input("hash-2"),
          createdAt: rotatedAt,
          lastUsedAt: rotatedAt,
          rotatedAt: null,
          revokedAt: null,
          successorCiphertext: null,
        });
        expect(successor?.id).not.toBe(first.id);
        expect(await context.repository.getByTokenHash("hash-1")).toEqual({
          ...first,
          rotatedAt,
          successorCiphertext: "cipher-1",
        });
        expect(await context.repository.getByTokenHash("hash-2")).toEqual(successor);
      });

      it("rotates a session only once: the second attempt gets null and changes nothing", async () => {
        const first = await context.repository.create(input());
        await context.repository.rotate(rotation(first.id));

        const second = await context.repository.rotate(rotation(first.id, "hash-3"));

        expect(second).toBeNull();
        expect(await context.repository.getByTokenHash("hash-3")).toBeNull();
      });

      it("lets only one of two concurrent rotations win", async () => {
        const first = await context.repository.create(input());

        const results = await Promise.all([
          context.repository.rotate(rotation(first.id, "hash-2")),
          context.repository.rotate(rotation(first.id, "hash-3")),
        ]);

        expect(results.filter((result) => result !== null)).toHaveLength(1);
      });

      it("does not rotate a revoked session", async () => {
        const first = await context.repository.create(input());
        await context.repository.revokeFamily(first.familyId, rotatedAt);

        expect(await context.repository.rotate(rotation(first.id))).toBeNull();
        expect(await context.repository.getByTokenHash("hash-2")).toBeNull();
      });

      it("returns null for a session that does not exist", async () => {
        expect(await context.repository.rotate(rotation("missing"))).toBeNull();
      });

      it("rejects a successor whose token hash is taken and leaves the session unrotated", async () => {
        const first = await context.repository.create(input());
        await context.repository.create(input("hash-2", "family-2"));

        await expect(context.repository.rotate(rotation(first.id))).rejects.toThrow();
        expect(await context.repository.getByTokenHash("hash-1")).toEqual(first);
      });
    });

    describe("revokeFamily", () => {
      const revokedAt = new Date("2026-10-18T13:00:00.000Z");

      it("revokes every session of the family and none of another family", async () => {
        const first = await context.repository.create(input("hash-1", "family-1"));
        await context.repository.rotate({
          sessionId: first.id,
          rotatedAt: revokedAt,
          successor: input("hash-2", "family-1"),
          successorCiphertext: "cipher-1",
        });
        await context.repository.create(input("hash-3", "family-2"));

        await context.repository.revokeFamily("family-1", revokedAt);

        expect((await context.repository.getByTokenHash("hash-1"))?.revokedAt).toEqual(revokedAt);
        expect((await context.repository.getByTokenHash("hash-2"))?.revokedAt).toEqual(revokedAt);
        expect((await context.repository.getByTokenHash("hash-3"))?.revokedAt).toBeNull();
      });

      it("drops the stored successor tokens of the family", async () => {
        const first = await context.repository.create(input());
        await context.repository.rotate({
          sessionId: first.id,
          rotatedAt: revokedAt,
          successor: input("hash-2"),
          successorCiphertext: "cipher-1",
        });

        await context.repository.revokeFamily("family-1", revokedAt);

        expect((await context.repository.getByTokenHash("hash-1"))?.successorCiphertext).toBeNull();
      });

      it("keeps the first revocation time when the family is revoked twice", async () => {
        await context.repository.create(input());

        await context.repository.revokeFamily("family-1", revokedAt);
        await context.repository.revokeFamily("family-1", new Date("2026-10-18T14:00:00.000Z"));

        expect((await context.repository.getByTokenHash("hash-1"))?.revokedAt).toEqual(revokedAt);
      });

      it("resolves without effect for a family that does not exist", async () => {
        await expect(
          context.repository.revokeFamily("missing", revokedAt),
        ).resolves.toBeUndefined();
      });
    });

    describe("clearExpiredSuccessors", () => {
      const rotatedAt = new Date("2026-10-18T12:00:00.000Z");
      const later = new Date("2026-10-18T12:00:11.000Z");
      const rotate = (sessionId: string, successorHash: string, familyId = "family-1") =>
        context.repository.rotate({
          sessionId,
          rotatedAt,
          successor: input(successorHash, familyId),
          successorCiphertext: `cipher-${successorHash}`,
        });

      it("drops the stored successor token of a session rotated before the cutoff and keeps the rotation", async () => {
        const first = await context.repository.create(input());
        await rotate(first.id, "hash-2");

        await context.repository.clearExpiredSuccessors("family-1", later);

        expect(await context.repository.getByTokenHash("hash-1")).toEqual({
          ...first,
          rotatedAt,
          successorCiphertext: null,
        });
      });

      it("keeps the stored successor token of a session rotated at or after the cutoff", async () => {
        const first = await context.repository.create(input());
        await rotate(first.id, "hash-2");

        await context.repository.clearExpiredSuccessors("family-1", rotatedAt);

        expect((await context.repository.getByTokenHash("hash-1"))?.successorCiphertext).toBe(
          "cipher-hash-2",
        );
      });

      it("leaves other families alone", async () => {
        const first = await context.repository.create(input("hash-1", "family-1"));
        const other = await context.repository.create(input("hash-3", "family-2"));
        await rotate(first.id, "hash-2");
        await rotate(other.id, "hash-4", "family-2");

        await context.repository.clearExpiredSuccessors("family-1", later);

        expect((await context.repository.getByTokenHash("hash-3"))?.successorCiphertext).toBe(
          "cipher-hash-4",
        );
      });
    });
  });
}
