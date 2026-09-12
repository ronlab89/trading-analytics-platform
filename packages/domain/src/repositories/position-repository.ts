import type { CreatePositionInput, Position } from "../entities/position";
import type { Money } from "../value-objects/money";

/**
 * Position repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * Position is a materialized projection derived from Transaction history
 * + market price (05-data-model.md §8, §31). This contract reflects that:
 * there is no generic `update()` — only synchronization operations that
 * match how a Position is actually kept current in practice.
 *
 * See portfolio-repository.ts for the full rationale on why this
 * contract lives in packages/domain with zero infrastructure
 * dependencies.
 */
export interface PositionRepository {
  /**
   * Returns all positions for a portfolio.
   * Source: FR-012 (Display Positions).
   */
  listByPortfolioId(portfolioId: string): Promise<Position[]>;

  /**
   * Returns a single position by id, or null if it does not exist.
   * Source: FR-013 (Position Detail).
   */
  getById(id: string): Promise<Position | null>;

  /**
   * Returns the position for a given portfolio+asset pair, or null if
   * the portfolio currently holds no position in that asset.
   * Backed by the `@@unique([portfolioId, assetId])` constraint in
   * packages/database schema.prisma.
   */
  getByPortfolioAndAsset(portfolioId: string, assetId: string): Promise<Position | null>;

  /**
   * Creates the position if none exists for this portfolio+asset pair,
   * or replaces its quantity/averageEntryPrice otherwise.
   * Source: FR-017's workflow ("Position recalculated" after a
   * transaction is created).
   *
   * Callers are expected to have already run `validateNewPosition` (see
   * entities/position.ts) on the resulting shape before calling this.
   */
  upsert(input: CreatePositionInput): Promise<Position>;

  /**
   * Updates only the current market price of a position.
   * Source: FR-045 (Update Dependent State), 08-realtime-spec.md §22 —
   * this is the high-frequency update path triggered by market events,
   * kept separate from `upsert` (the transaction-driven path) so callers
   * and future implementations can optimize/observe them independently.
   */
  updateCurrentPrice(id: string, currentPrice: Money): Promise<Position>;

  /**
   * Removes a position, e.g. when it has been fully closed (quantity
   * reached zero). Scoped by portfolio+asset rather than a bare id to
   * keep the operation explicit about what is being closed.
   */
  deleteByPortfolioAndAsset(portfolioId: string, assetId: string): Promise<void>;
}
