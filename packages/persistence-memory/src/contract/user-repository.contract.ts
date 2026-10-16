import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@trading/domain";
import type { CreateUserInput, UserRepository } from "@trading/domain";

export interface UserContractContext {
  readonly repository: UserRepository;
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/** Every email the suite creates starts with this, so an adapter can clean up by it. */
export const USER_CONTRACT_EMAIL_PREFIX = "ct-user-";

/**
 * Behavior every `UserRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Every user gets a unique email, so the suite also runs against a shared
 * database. `list` is only checked for containment because it returns every
 * user of the storage; its insertion order is checked by the in-memory tests.
 */
export function userRepositoryContract(
  name: string,
  factory: () => Promise<UserContractContext>,
): void {
  describe(`${name} (UserRepository contract)`, () => {
    let context: UserContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (overrides: Partial<CreateUserInput> = {}) => ({
      email: `${USER_CONTRACT_EMAIL_PREFIX}${crypto.randomUUID()}@example.com`,
      displayName: "Ana",
      ...overrides,
    });

    it("creates a USER with an id by default", async () => {
      const data = input();
      const created = await context.repository.create(data);
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({ ...data, role: UserRole.USER });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("keeps an explicit role", async () => {
      const created = await context.repository.create(input({ role: UserRole.ADMIN }));
      expect(created.role).toBe(UserRole.ADMIN);
    });

    it("rejects a second user with the same email", async () => {
      const data = input();
      await context.repository.create(data);
      await expect(context.repository.create({ ...data, displayName: "Other" })).rejects.toThrow();
    });

    it("finds a user by id and by email, and returns null otherwise", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
      expect(await context.repository.getByEmail(created.email)).toEqual(created);
      expect(await context.repository.getByEmail(input().email)).toBeNull();
    });

    it("lists the users that were created", async () => {
      const first = await context.repository.create(input());
      const second = await context.repository.create(input({ displayName: "Bo" }));
      const users = await context.repository.list();
      expect(users).toContainEqual(first);
      expect(users).toContainEqual(second);
    });

    it("updates the display name and role only, and does not move updatedAt backwards", async () => {
      const created = await context.repository.create(input());
      const updated = await context.repository.update(created.id, {
        displayName: "Ana M.",
        role: UserRole.ADMIN,
      });
      expect(updated).toMatchObject({
        id: created.id,
        email: created.email,
        displayName: "Ana M.",
        role: UserRole.ADMIN,
      });
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("throws when updating a user that does not exist", async () => {
      await expect(
        context.repository.update("nonexistent-id", { displayName: "x" }),
      ).rejects.toThrow();
    });
  });
}
