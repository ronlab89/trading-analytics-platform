import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DecisionDirection, Money } from "@trading/domain";
import type { CreateDecisionInput, DecisionRepository } from "@trading/domain";

export interface DecisionContractContext {
  readonly repository: DecisionRepository;
  readonly fixtures: {
    /** An existing portfolio that owns the decisions created by the suite. */
    readonly portfolioId: string;
    /** A second existing portfolio, to check listing is scoped by portfolio. */
    readonly otherPortfolioId: string;
    /** An existing asset the decisions are about. */
    readonly assetId: string;
    /** A second existing asset, to check the asset filter. */
    readonly otherAssetId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

/**
 * Behavior every `DecisionRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Every decision the ordering and filter cases create has a different
 * `createdAt`, so the expected order is exact in every storage. The order of
 * decisions that share an instant is checked by the in-memory tests.
 * Amounts have no trailing zeros, so they read back identical whatever the
 * storage keeps for decimals.
 */
export function decisionRepositoryContract(
  name: string,
  factory: () => Promise<DecisionContractContext>,
): void {
  describe(`${name} (DecisionRepository contract)`, () => {
    let context: DecisionContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (overrides: Partial<CreateDecisionInput> = {}) => ({
      portfolioId: context.fixtures.portfolioId,
      assetId: context.fixtures.assetId,
      title: "Buy the dip",
      thesis: "Earnings are underpriced",
      direction: DecisionDirection.LONG,
      ...overrides,
    });
    const listedCreatedAt = async (
      filter: Parameters<DecisionRepository["listByPortfolioId"]>[1],
    ) =>
      (await context.repository.listByPortfolioId(context.fixtures.portfolioId, filter)).map(
        (d) => d.createdAt,
      );

    it("creates an open decision with an id and null optional fields", async () => {
      const created = await context.repository.create(input());
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({
        ...input(),
        entryPrice: null,
        targetPrice: null,
        stopPrice: null,
        riskLevel: null,
        notes: null,
        closedAt: null,
        outcome: null,
      });
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it("keeps explicit prices, risk level and notes", async () => {
      const created = await context.repository.create(
        input({
          entryPrice: Money.of("180", "USD"),
          targetPrice: Money.of("195", "USD"),
          stopPrice: Money.of("174", "USD"),
          riskLevel: "HIGH",
          notes: "Watch the earnings call",
        }),
      );
      expect(created.entryPrice).toEqual(Money.of("180", "USD"));
      expect(created.targetPrice).toEqual(Money.of("195", "USD"));
      expect(created.stopPrice).toEqual(Money.of("174", "USD"));
      expect(created.riskLevel).toBe("HIGH");
      expect(created.notes).toBe("Watch the earnings call");
    });

    it("keeps a historical createdAt", async () => {
      const created = await context.repository.create(input({ createdAt: day(3) }));
      expect(created.createdAt).toEqual(day(3));
    });

    it("finds a decision by id and returns null for an unknown id", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
    });

    it("lists only the given portfolio's decisions, newest first", async () => {
      const { portfolioId, otherPortfolioId } = context.fixtures;
      expect(await context.repository.listByPortfolioId(portfolioId)).toEqual([]);
      const old = await context.repository.create(input({ createdAt: day(2) }));
      const recent = await context.repository.create(input({ createdAt: day(20) }));
      const middle = await context.repository.create(input({ createdAt: day(10) }));
      await context.repository.create(input({ portfolioId: otherPortfolioId }));
      expect(await context.repository.listByPortfolioId(portfolioId)).toEqual([
        recent,
        middle,
        old,
      ]);
    });

    it("filters by asset, direction and an inclusive createdAt range", async () => {
      await context.repository.create(input({ createdAt: day(5) }));
      await context.repository.create(
        input({ assetId: context.fixtures.otherAssetId, createdAt: day(10) }),
      );
      await context.repository.create(
        input({ direction: DecisionDirection.SHORT, createdAt: day(15) }),
      );
      await context.repository.create(input({ createdAt: day(25) }));
      expect(await listedCreatedAt({ assetId: context.fixtures.otherAssetId })).toEqual([day(10)]);
      expect(await listedCreatedAt({ direction: DecisionDirection.SHORT })).toEqual([day(15)]);
      expect(await listedCreatedAt({ dateFrom: day(10), dateTo: day(15) })).toEqual([
        day(15),
        day(10),
      ]);
      expect(await listedCreatedAt({ dateFrom: day(20) })).toEqual([day(25)]);
      expect(await listedCreatedAt({ dateTo: day(5) })).toEqual([day(5)]);
    });

    it("updates only the given fields", async () => {
      const created = await context.repository.create(input());
      const updated = await context.repository.update(created.id, {
        title: "New title",
        notes: "Adjusted",
      });
      expect(updated).toEqual({ ...created, title: "New title", notes: "Adjusted" });
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("clears a price with null and keeps the others", async () => {
      const created = await context.repository.create(
        input({ entryPrice: Money.of("100", "USD"), targetPrice: Money.of("120", "USD") }),
      );
      const updated = await context.repository.update(created.id, { targetPrice: null });
      expect(updated.targetPrice).toBeNull();
      expect(updated.entryPrice).toEqual(Money.of("100", "USD"));
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("closes a decision with its outcome and closing date", async () => {
      const created = await context.repository.create(input());
      const closed = await context.repository.close(created.id, "Target hit", day(12));
      expect(closed).toMatchObject({ outcome: "Target hit", closedAt: day(12) });
      expect(await context.repository.getById(created.id)).toEqual(closed);
    });

    it("throws when updating or closing a decision that does not exist", async () => {
      await expect(context.repository.update("nonexistent-id", { title: "x" })).rejects.toThrow();
      await expect(context.repository.close("nonexistent-id", "x", day(1))).rejects.toThrow();
    });
  });
}
