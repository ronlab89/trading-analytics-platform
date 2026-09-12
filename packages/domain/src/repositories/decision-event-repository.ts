import type { CreateDecisionEventInput, DecisionEvent } from "../entities/decision-event";

/**
 * DecisionEvent repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * No `update()` or `delete()`: decision events form an immutable
 * chronological history that Decision Replay folds over
 * (05-data-model.md §12-13). Once recorded, an event does not change —
 * the same historical-integrity reasoning applied to Transaction
 * (transaction-repository.ts) applies here.
 *
 * See portfolio-repository.ts for the full rationale on why this
 * contract lives in packages/domain with zero infrastructure
 * dependencies.
 */
export interface DecisionEventRepository {
  /**
   * Returns all events for a decision, in chronological order.
   * Source: FR-034 (Replay Decision) — the ordered list this method
   * returns is exactly what the replay controller folds over
   * (06-architecture.md §53, "Data Flow Example — Decision Replay").
   */
  listByDecisionId(decisionId: string): Promise<DecisionEvent[]>;

  /**
   * Appends a new event to a decision's history.
   * Callers are expected to have already run `validateNewDecisionEvent`
   * (see entities/decision-event.ts) before calling this.
   */
  create(input: CreateDecisionEventInput): Promise<DecisionEvent>;
}
