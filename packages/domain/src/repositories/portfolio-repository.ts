import type { CreatePortfolioInput, Portfolio } from "../entities/portfolio";

/**
 * Portfolio repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * This interface is the only thing the application layer depends on.
 * Real (Prisma-backed) and mock (in-memory, demo) implementations must
 * both satisfy this exact contract — see docs/12-demo-mode-spec.md §4
 * (Infrastructure Substitution) and docs/06-architecture.md §3.3
 * (Dependency Inversion).
 *
 * This file intentionally has zero dependency on Prisma, HTTP, or any
 * other infrastructure concern. It lives in `packages/domain` precisely
 * so that infrastructure packages depend on the domain, never the
 * reverse.
 */
export interface PortfolioRepository {
  /**
   * Returns all portfolios belonging to the given user.
   * Source: FR-008 (List Portfolios).
   */
  listByUserId(userId: string): Promise<Portfolio[]>;

  /**
   * Returns a single portfolio by id, or null if it does not exist.
   *
   * This method does not perform ownership/authorization checks — that
   * is an application-layer concern (see docs/09-security-spec.md §14,
   * Resource Ownership). The repository only answers "does this row
   * exist", not "is the caller allowed to see it".
   */
  getById(id: string): Promise<Portfolio | null>;

  /**
   * Creates a new portfolio.
   * Source: FR-009 (Create Portfolio).
   *
   * Callers are expected to have already run `validateNewPortfolio`
   * (see entities/portfolio.ts) before calling this — the repository
   * is not responsible for re-validating domain invariants.
   */
  create(input: CreatePortfolioInput): Promise<Portfolio>;

  /**
   * Updates supported, mutable fields of an existing portfolio.
   * Source: FR-010 (Edit Portfolio).
   *
   * Partial by design: callers pass only the fields they intend to
   * change. `status` transitions (e.g. archiving — FR-011) go through
   * this same method rather than a dedicated `archive()` method, since
   * 05-data-model.md §6 models archiving as a status change, not a
   * distinct domain operation.
   *
   * Throws if no portfolio exists with the given id — callers that need
   * to distinguish "not found" from other failures should call
   * `getById` first when that distinction matters.
   */
  update(
    id: string,
    input: Partial<Pick<Portfolio, "name" | "description" | "baseCurrency" | "status">>,
  ): Promise<Portfolio>;

  /**
   * Deletes a portfolio.
   * Source: FR-011 (Delete Portfolio).
   *
   * Note: 05-data-model.md §6 and NFR favor archiving over destructive
   * deletion for historical integrity. This method exists to satisfy
   * the contract shape from 06-architecture.md §12, but application
   * services should prefer `update(id, { status: "ARCHIVED" })` in
   * normal product flows. Hard deletion remains available for cases
   * that genuinely require it (e.g. demo reset, test cleanup).
   */
  delete(id: string): Promise<void>;
}
