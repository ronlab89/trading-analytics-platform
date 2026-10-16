import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DecisionEventType } from "@trading/domain";
import type { DecisionEventRepository } from "@trading/domain";

export interface DecisionEventContractContext {
  readonly repository: DecisionEventRepository;
  readonly fixtures: {
    /** An existing decision that owns the events created by the suite. */
    readonly decisionId: string;
    /** A second existing decision, to check listing is scoped by decision. */
    readonly otherDecisionId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

/**
 * Behavior every `DecisionEventRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Every listed event has a different timestamp, so the expected order is exact
 * in every storage. The order of events that share an instant is checked by
 * the in-memory tests.
 */
export function decisionEventRepositoryContract(
  name: string,
  factory: () => Promise<DecisionEventContractContext>,
): void {
  describe(`${name} (DecisionEventRepository contract)`, () => {
    let context: DecisionEventContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    it("creates an event with an id, its type and an empty payload by default", async () => {
      const created = await context.repository.create({
        decisionId: context.fixtures.decisionId,
        type: DecisionEventType.PRICE_UPDATE,
      });
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({
        decisionId: context.fixtures.decisionId,
        type: DecisionEventType.PRICE_UPDATE,
        payload: {},
      });
      expect(created.timestamp).toBeInstanceOf(Date);
    });

    it("uses the current time when the timestamp is omitted", async () => {
      const before = Date.now();
      const created = await context.repository.create({
        decisionId: context.fixtures.decisionId,
        type: DecisionEventType.PRICE_UPDATE,
      });
      const after = Date.now();
      expect(created.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(created.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it("keeps an explicit payload and a historical timestamp", async () => {
      const created = await context.repository.create({
        decisionId: context.fixtures.decisionId,
        type: DecisionEventType.PRICE_UPDATE,
        payload: { price: "101" },
        timestamp: day(4),
      });
      expect(created.payload).toEqual({ price: "101" });
      expect(created.timestamp).toEqual(day(4));
    });

    it("lists one decision's events, oldest first, whatever the insertion order", async () => {
      const { decisionId, otherDecisionId } = context.fixtures;
      expect(await context.repository.listByDecisionId(decisionId)).toEqual([]);
      const late = await context.repository.create({
        decisionId,
        type: DecisionEventType.TARGET_REACHED,
        timestamp: day(15),
      });
      const early = await context.repository.create({
        decisionId,
        type: DecisionEventType.DECISION_CREATED,
        timestamp: day(2),
      });
      const middle = await context.repository.create({
        decisionId,
        type: DecisionEventType.PRICE_UPDATE,
        timestamp: day(9),
      });
      await context.repository.create({
        decisionId: otherDecisionId,
        type: DecisionEventType.PRICE_UPDATE,
        timestamp: day(5),
      });
      expect(await context.repository.listByDecisionId(decisionId)).toEqual([early, middle, late]);
    });
  });
}
