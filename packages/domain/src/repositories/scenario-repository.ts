import type { CreateScenarioInput, Scenario, ScenarioChange } from "../entities/scenario";

/**
 * Scenario repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * See portfolio-repository.ts for the full rationale on why this
 * contract lives in packages/domain with zero infrastructure
 * dependencies.
 */
export interface ScenarioRepository {
  /**
   * Returns scenarios for a portfolio, newest first (by `createdAt`,
   * ties broken by `id`) so the order is deterministic.
   * Source: FR-036 (Create Scenario) implies listing; 07-api-spec.md §25
   * (GET /portfolios/:portfolioId/scenarios).
   */
  listByPortfolioId(portfolioId: string): Promise<Scenario[]>;

  /**
   * Returns a single scenario by id, or null if it does not exist.
   */
  getById(id: string): Promise<Scenario | null>;

  /**
   * Creates a new scenario, with its `changes` when provided (default:
   * none).
   * Source: FR-036 (Create Scenario). Creating a scenario must not
   * modify the baseline portfolio (01-product-spec.md §15.1) — this
   * repository only ever writes to the `scenarios` table.
   */
  create(input: CreateScenarioInput): Promise<Scenario>;

  /**
   * Updates a scenario's name, description, status and/or variable
   * changes in a single write, so a combined edit (e.g. rename and
   * change variables) is atomic and cannot leave the scenario half
   * updated. Fields left out are untouched.
   * Source: 07-api-spec.md §25 (PATCH .../scenarios/:scenarioId),
   * FR-037, FR-039, FR-040.
   */
  update(
    id: string,
    input: Partial<Pick<Scenario, "name" | "description" | "status" | "changes">>,
  ): Promise<Scenario>;

  /**
   * Replaces a scenario's variable changes and returns the updated
   * scenario (including the new `changes`).
   * Source: FR-037 (Modify Scenario Variables), FR-039 (Reset Scenario —
   * called with an empty array). A changes-only shortcut for the
   * frequent, interactive write path during Scenario Lab usage
   * (01-product-spec.md §15); `update` can carry `changes` too.
   */
  updateChanges(id: string, changes: readonly ScenarioChange[]): Promise<Scenario>;

  /**
   * Deletes a scenario.
   * Source: FR-043 (Delete Scenario).
   */
  delete(id: string): Promise<void>;
}
