import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScenarioStatus } from "@trading/domain";
import type { CreateScenarioInput, ScenarioRepository } from "@trading/domain";

export interface ScenarioContractContext {
  readonly repository: ScenarioRepository;
  readonly fixtures: {
    /** An existing portfolio that owns the scenarios created by the suite. */
    readonly portfolioId: string;
    /** A second existing portfolio, to check listing is scoped by portfolio. */
    readonly otherPortfolioId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

const change = { assetId: "asset-1", percentChange: -12 };

/**
 * Behavior every `ScenarioRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Listing is checked as a set, newest first by `createdAt`: two scenarios
 * created within the same millisecond have no order the storages agree on. The
 * in-memory tie-break and the Prisma-only checks (malformed stored changes, an
 * explicit `createdAt`) live in their own tests.
 */
export function scenarioRepositoryContract(
  name: string,
  factory: () => Promise<ScenarioContractContext>,
): void {
  describe(`${name} (ScenarioRepository contract)`, () => {
    let context: ScenarioContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (overrides: Partial<CreateScenarioInput> = {}) => ({
      portfolioId: context.fixtures.portfolioId,
      name: "Crash",
      ...overrides,
    });

    it("creates a DRAFT scenario with an id, no description or snapshot and no changes", async () => {
      const created = await context.repository.create(input());
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({
        ...input(),
        description: null,
        baseSnapshotId: null,
        status: ScenarioStatus.DRAFT,
        changes: [],
      });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("keeps an explicit description, snapshot, status and changes", async () => {
      const created = await context.repository.create(
        input({
          description: "Tech falls",
          baseSnapshotId: "snapshot-1",
          status: ScenarioStatus.SAVED,
          changes: [change],
        }),
      );
      expect(created).toMatchObject({
        description: "Tech falls",
        baseSnapshotId: "snapshot-1",
        status: ScenarioStatus.SAVED,
        changes: [change],
      });
    });

    it("finds a scenario by id and returns null for an unknown id", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
    });

    it("lists only the given portfolio's scenarios, newest first", async () => {
      const { portfolioId, otherPortfolioId } = context.fixtures;
      expect(await context.repository.listByPortfolioId(portfolioId)).toEqual([]);
      const created = [];
      for (const name of ["first", "second", "third"]) {
        created.push(await context.repository.create(input({ name })));
      }
      await context.repository.create(input({ portfolioId: otherPortfolioId }));
      const listed = await context.repository.listByPortfolioId(portfolioId);
      expect(listed.map((s) => s.id).sort()).toEqual(created.map((s) => s.id).sort());
      const times = listed.map((s) => s.createdAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it("updates only the given fields and does not move updatedAt backwards", async () => {
      const created = await context.repository.create(input({ changes: [change] }));
      const updated = await context.repository.update(created.id, {
        name: "Renamed",
        status: ScenarioStatus.SAVED,
      });
      expect(updated).toMatchObject({
        name: "Renamed",
        status: ScenarioStatus.SAVED,
        changes: [change],
      });
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("updates the name and the changes together in one call", async () => {
      const created = await context.repository.create(input({ changes: [change] }));
      const replacement = [{ assetId: "asset-2", percentChange: -8 }];
      const updated = await context.repository.update(created.id, {
        name: "After",
        changes: replacement,
      });
      expect(updated).toMatchObject({ name: "After", changes: replacement });
      expect((await context.repository.getById(created.id))?.changes).toEqual(replacement);
    });

    it("replaces the changes as a whole, and an empty array resets them", async () => {
      const created = await context.repository.create(input({ changes: [change] }));
      const replacement = [
        { assetId: "asset-2", percentChange: 10 },
        { assetId: "asset-3", percentChange: -5 },
      ];
      const replaced = await context.repository.updateChanges(created.id, replacement);
      expect(replaced.id).toBe(created.id);
      expect(replaced.name).toBe(created.name);
      expect(replaced.changes).toEqual(replacement);
      expect((await context.repository.getById(created.id))?.changes).toEqual(replacement);
      const listed = await context.repository.listByPortfolioId(context.fixtures.portfolioId);
      expect(listed.find((s) => s.id === created.id)?.changes).toEqual(replacement);
      const reset = await context.repository.updateChanges(created.id, []);
      expect(reset.changes).toEqual([]);
    });

    it("deletes a scenario", async () => {
      const created = await context.repository.create(input());
      await context.repository.delete(created.id);
      expect(await context.repository.getById(created.id)).toBeNull();
    });

    it("throws when updating, replacing the changes of, or deleting a missing scenario", async () => {
      await expect(context.repository.update("nonexistent-id", { name: "x" })).rejects.toThrow();
      await expect(context.repository.updateChanges("nonexistent-id", [])).rejects.toThrow();
      await expect(context.repository.delete("nonexistent-id")).rejects.toThrow();
    });
  });
}
