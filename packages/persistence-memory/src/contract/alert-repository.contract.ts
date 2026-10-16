import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AlertType } from "@trading/domain";
import type { AlertRepository, CreateAlertInput } from "@trading/domain";

export interface AlertContractContext {
  readonly repository: AlertRepository;
  readonly fixtures: {
    /** An existing user that owns the alerts created by the suite. */
    readonly userId: string;
    /** A second existing user, to check listing is scoped by owner. */
    readonly otherUserId: string;
    /** An existing asset an alert can point at. */
    readonly assetId: string;
    /** An existing portfolio an alert can point at. */
    readonly portfolioId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `AlertRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Listing is only checked as a set: the storages do not promise the same
 * order. The insertion order of the in-memory implementation is checked by its
 * own tests.
 */
export function alertRepositoryContract(
  name: string,
  factory: () => Promise<AlertContractContext>,
): void {
  describe(`${name} (AlertRepository contract)`, () => {
    let context: AlertContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (overrides: Partial<CreateAlertInput> = {}) => ({
      userId: context.fixtures.userId,
      type: AlertType.PRICE,
      condition: "ABOVE",
      threshold: 100,
      ...overrides,
    });
    const idsOf = async (userId: string) =>
      (await context.repository.listByUserId(userId)).map((alert) => alert.id).sort();

    it("creates an enabled alert with an id and no asset or portfolio by default", async () => {
      const created = await context.repository.create(input());
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({
        ...input(),
        assetId: null,
        portfolioId: null,
        enabled: true,
      });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("keeps an explicit asset, portfolio and enabled flag", async () => {
      const { assetId, portfolioId } = context.fixtures;
      const created = await context.repository.create(
        input({ assetId, portfolioId, enabled: false }),
      );
      expect(created).toMatchObject({ assetId, portfolioId, enabled: false });
    });

    it("finds an alert by id and returns null for an unknown id", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
    });

    it("lists only the given user's alerts", async () => {
      const { userId, otherUserId } = context.fixtures;
      expect(await idsOf(userId)).toEqual([]);
      const first = await context.repository.create(input());
      const second = await context.repository.create(input());
      const other = await context.repository.create(input({ userId: otherUserId }));
      expect(await idsOf(userId)).toEqual([first.id, second.id].sort());
      expect(await idsOf(otherUserId)).toEqual([other.id]);
    });

    it("updates only the given fields and does not move updatedAt backwards", async () => {
      const created = await context.repository.create(input());
      const updated = await context.repository.update(created.id, {
        enabled: false,
        threshold: 150,
      });
      expect(updated).toMatchObject({ ...input(), enabled: false, threshold: 150 });
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("deletes an alert", async () => {
      const created = await context.repository.create(input());
      await context.repository.delete(created.id);
      expect(await context.repository.getById(created.id)).toBeNull();
    });

    it("throws when updating or deleting an alert that does not exist", async () => {
      await expect(
        context.repository.update("nonexistent-id", { enabled: false }),
      ).rejects.toThrow();
      await expect(context.repository.delete("nonexistent-id")).rejects.toThrow();
    });
  });
}
