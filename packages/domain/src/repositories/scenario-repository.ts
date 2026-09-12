import type { CreateScenarioInput, Scenario } from "../entities/scenario";

/**
 * A single hypothetical modification within a scenario.
 * Source: docs/05-data-model.md §15 (Scenario Variable).
 *
 * Matches the plain shape already used by
 * calculations/scenario-impact.ts (see PROGRESS.md decision table) —
 * the persisted `changes` Json column stores an array of this shape.
 */
export interface ScenarioChange {
  readonly assetId: string;
  readonly percentChange: number;
}

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
   * Returns scenarios for a portfolio.
   * Source: FR-036 (Create Scenario) implies listing; 07-api-spec.md §25
   * (GET /portfolios/:portfolioId/scenarios).
   */
  listByPortfolioId(portfolioId: string): Promise<Scenario[]>;

  /**
   * Returns a single scenario by id, or null if it does not exist.
   */
  getById(id: string): Promise<Scenario | null>;

  /**
   * Creates a new scenario.
   * Source: FR-036 (Create Scenario). Creating a scenario must not
   * modify the baseline portfolio (01-product-spec.md §15.1) — this
   * repository only ever writes to the `scenarios` table.
   */
  create(input: CreateScenarioInput): Promise<Scenario>;

  /**
   * Updates scenario metadata (not its variable changes).
   * Source: 07-api-spec.md §25 (PATCH .../scenarios/:scenarioId).
   */
  update(
    id: string,
    input: Partial<Pick<Scenario, "name" | "description" | "status">>,
  ): Promise<Scenario>;

  /**
   * Replaces a scenario's variable changes.
   * Source: FR-037 (Modify Scenario Variables), FR-039 (Reset Scenario —
   * called with an empty array). Kept separate from `update` since this
   * is the frequent, interactive write path during Scenario Lab usage
   * (01-product-spec.md §15), distinct from editing name/description.
   */
  updateChanges(id: string, changes: ScenarioChange[]): Promise<Scenario>;

  /**
   * Deletes a scenario.
   * Source: FR-043 (Delete Scenario).
   */
  delete(id: string): Promise<void>;
}
