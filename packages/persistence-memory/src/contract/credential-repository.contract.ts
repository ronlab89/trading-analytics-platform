import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CredentialRepository } from "@trading/domain";

export interface CredentialContractContext {
  readonly repository: CredentialRepository;
  readonly fixtures: {
    /** An existing user that owns the credential created by the suite. */
    readonly userId: string;
    /** A second existing user, who never gets a credential unless a test gives one. */
    readonly otherUserId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `CredentialRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * The hashes are fake strings: hashing is the caller's job, so the repository
 * must keep whatever it receives exactly as received.
 */
export function credentialRepositoryContract(
  name: string,
  factory: () => Promise<CredentialContractContext>,
): void {
  describe(`${name} (CredentialRepository contract)`, () => {
    let context: CredentialContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = () => ({ userId: context.fixtures.userId, passwordHash: "$2a$12$initialhash" });

    it("returns null before a credential has ever been created", async () => {
      expect(await context.repository.getByUserId(context.fixtures.userId)).toBeNull();
    });

    it("stores the password hash exactly as received", async () => {
      const created = await context.repository.create(input());
      expect(created).toMatchObject(input());
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("finds the credential of a user and returns null for another one", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getByUserId(context.fixtures.userId)).toEqual(created);
      expect(await context.repository.getByUserId(context.fixtures.otherUserId)).toBeNull();
    });

    it("rejects a second credential for the same user", async () => {
      await context.repository.create(input());
      await expect(
        context.repository.create({ ...input(), passwordHash: "$2a$12$otherhash" }),
      ).rejects.toThrow();
    });

    it("replaces the password hash, keeps createdAt and does not move updatedAt backwards", async () => {
      const created = await context.repository.create(input());
      const updated = await context.repository.updatePasswordHash(
        context.fixtures.userId,
        "$2a$12$rotatedhash",
      );
      expect(updated.passwordHash).toBe("$2a$12$rotatedhash");
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      expect(await context.repository.getByUserId(context.fixtures.userId)).toEqual(updated);
    });

    it("throws when replacing the hash of a user without a credential", async () => {
      await expect(
        context.repository.updatePasswordHash(context.fixtures.otherUserId, "$2a$12$hash"),
      ).rejects.toThrow();
    });
  });
}
