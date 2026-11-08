import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UserPreferenceRepository } from "@trading/domain";

export interface UserPreferenceContractContext {
  readonly repository: UserPreferenceRepository;
  readonly fixtures: {
    /** An existing user that owns the preferences created by the suite. */
    readonly userId: string;
    /** A second existing user, to check preferences are scoped by owner. */
    readonly otherUserId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `UserPreferenceRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 */
export function userPreferenceRepositoryContract(
  name: string,
  factory: () => Promise<UserPreferenceContractContext>,
): void {
  describe(`${name} (UserPreferenceRepository contract)`, () => {
    let context: UserPreferenceContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = () => ({
      userId: context.fixtures.userId,
      theme: "dark",
      language: "en",
    });

    it("returns null for a user who never saved preferences", async () => {
      expect(await context.repository.getByUserId(context.fixtures.userId)).toBeNull();
    });

    it("creates preferences with the schema defaults for the optional fields", async () => {
      const created = await context.repository.create(input());
      expect(created).toMatchObject({
        ...input(),
        defaultPortfolioId: null,
        reducedMotion: false,
        notificationPreferences: {},
      });
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("keeps explicit optional fields", async () => {
      const created = await context.repository.create({
        ...input(),
        defaultPortfolioId: "portfolio-1",
        reducedMotion: true,
        notificationPreferences: { email: false },
      });
      expect(created).toMatchObject({
        defaultPortfolioId: "portfolio-1",
        reducedMotion: true,
        notificationPreferences: { email: false },
      });
    });

    it("rejects a second row for the same user", async () => {
      await context.repository.create(input());
      await expect(context.repository.create({ ...input(), theme: "light" })).rejects.toThrow();
    });

    it("finds the preferences of the given user only", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getByUserId(context.fixtures.userId)).toEqual(created);
      expect(await context.repository.getByUserId(context.fixtures.otherUserId)).toBeNull();
    });

    it("updates only the given fields and does not move updatedAt backwards", async () => {
      const created = await context.repository.create(input());
      const updated = await context.repository.update(context.fixtures.userId, {
        theme: "light",
        reducedMotion: true,
        notificationPreferences: { email: false, push: true },
      });
      expect(updated).toMatchObject({
        userId: context.fixtures.userId,
        theme: "light",
        language: "en",
        reducedMotion: true,
        notificationPreferences: { email: false, push: true },
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      expect(await context.repository.getByUserId(context.fixtures.userId)).toEqual(updated);
    });

    it("clears the default portfolio with null", async () => {
      await context.repository.create({ ...input(), defaultPortfolioId: "portfolio-1" });
      const updated = await context.repository.update(context.fixtures.userId, {
        defaultPortfolioId: null,
      });
      expect(updated.defaultPortfolioId).toBeNull();
    });

    it("creates the row on the first update, with the schema defaults (upsert)", async () => {
      const created = await context.repository.update(context.fixtures.userId, {
        reducedMotion: true,
      });
      expect(created).toMatchObject({
        userId: context.fixtures.userId,
        theme: "system",
        language: "en",
        defaultPortfolioId: null,
        reducedMotion: true,
        notificationPreferences: {},
      });
      expect(await context.repository.getByUserId(context.fixtures.userId)).toEqual(created);
    });
  });
}
