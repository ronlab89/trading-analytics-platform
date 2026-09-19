import type { CreateDecisionInput, Decision } from "../entities/decision";
import type { DecisionDirection } from "../entities/enums";

/**
 * Decision repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * See portfolio-repository.ts for the full rationale on why this
 * contract lives in packages/domain with zero infrastructure
 * dependencies.
 */
export interface DecisionRepository {
  /**
   * Returns decisions for a portfolio, optionally filtered.
   * Source: FR-032 (List Decisions).
   */
  listByPortfolioId(
    portfolioId: string,
    filter?: {
      assetId?: string;
      direction?: DecisionDirection;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<Decision[]>;

  /**
   * Returns a single decision by id, or null if it does not exist.
   * Source: FR-033 (Decision Detail).
   */
  getById(id: string): Promise<Decision | null>;

  /**
   * Creates a new decision.
   * Source: 07-api-spec.md §23 (POST /portfolios/:portfolioId/decisions).
   *
   * Callers are expected to have already run `validateNewDecision` (see
   * entities/decision.ts) before calling this.
   */
  create(input: CreateDecisionInput): Promise<Decision>;

  /**
   * Updates supported, mutable fields of an open decision.
   * Source: 07-api-spec.md §23 (PATCH .../decisions/:decisionId).
   */
  update(
    id: string,
    input: Partial<
      Pick<Decision, "title" | "thesis" | "targetPrice" | "stopPrice" | "riskLevel" | "notes">
    >,
  ): Promise<Decision>;

  /**
   * Closes a decision, recording its outcome.
   * Source: 07-api-spec.md §23 (POST .../decisions/:decisionId/close).
   * Kept separate from `update` because closing is a distinct business
   * operation with its own API endpoint, not a generic field edit.
   */
  close(id: string, outcome: string, closedAt: Date): Promise<Decision>;
}
