import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PortfolioStatus } from "@trading/domain";
import type { PortfolioRepository } from "@trading/domain";

export interface PortfolioContractContext {
  readonly repository: PortfolioRepository;
  readonly fixtures: {
    /** An existing user that owns the portfolios created by the suite. */
    readonly userId: string;
    /** A second existing user, to check listing is scoped by owner. */
    readonly otherUserId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `PortfolioRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 */
export function portfolioRepositoryContract(
  name: string,
  factory: () => Promise<PortfolioContractContext>,
): void {
  describe(`${name} (PortfolioRepository contract)`, () => {
    let context: PortfolioContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = () => ({
      userId: context.fixtures.userId,
      name: "Growth",
      baseCurrency: "USD",
    });

    it("creates a portfolio with an id, ACTIVE status and no description by default", async () => {
      const created = await context.repository.create(input());
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({
        ...input(),
        description: null,
        status: PortfolioStatus.ACTIVE,
      });
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it("keeps an explicit description and status", async () => {
      const created = await context.repository.create({
        ...input(),
        description: "Long term",
        status: PortfolioStatus.ARCHIVED,
      });
      expect(created.description).toBe("Long term");
      expect(created.status).toBe(PortfolioStatus.ARCHIVED);
    });

    it("gives every portfolio its own id", async () => {
      const first = await context.repository.create(input());
      const second = await context.repository.create(input());
      expect(first.id).not.toBe(second.id);
    });

    it("finds a portfolio by id and returns null for an unknown id", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
    });

    it("lists only the portfolios of the given user", async () => {
      const mine = await context.repository.create(input());
      await context.repository.create({ ...input(), userId: context.fixtures.otherUserId });
      expect(await context.repository.listByUserId(context.fixtures.userId)).toEqual([mine]);
    });

    it("updates only the given fields and does not move updatedAt backwards", async () => {
      const created = await context.repository.create(input());
      const updated = await context.repository.update(created.id, { name: "Renamed" });
      expect(updated).toMatchObject({ ...input(), name: "Renamed", id: created.id });
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("archives through update", async () => {
      const created = await context.repository.create(input());
      const updated = await context.repository.update(created.id, {
        status: PortfolioStatus.ARCHIVED,
      });
      expect(updated.status).toBe(PortfolioStatus.ARCHIVED);
    });

    it("throws when updating or deleting a portfolio that does not exist", async () => {
      await expect(context.repository.update("nonexistent-id", { name: "x" })).rejects.toThrow();
      await expect(context.repository.delete("nonexistent-id")).rejects.toThrow();
    });

    it("deletes a portfolio", async () => {
      const created = await context.repository.create(input());
      await context.repository.delete(created.id);
      expect(await context.repository.getById(created.id)).toBeNull();
    });
  });
}
