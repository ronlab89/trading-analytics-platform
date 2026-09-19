import { PrismaPositionRepository } from "@trading/database";
import {
  calculatePositionMetrics,
  type Position,
  type PositionMetrics,
} from "../../../../packages/domain/src";
import { getPortfolioById } from "./portfolio.service";
import { AppError } from "../errors/app-error";

const positionRepository = new PrismaPositionRepository();

/**
 * Returns every position held by a portfolio.
 * Source: FR-012 (Display Positions).
 *
 * Deliberately read-only: per 05-data-model.md §8, a Position is a
 * materialized projection derived from transaction history and market
 * data, not something created directly through this API. There is no
 * corresponding POST/PATCH/DELETE — 07-api-spec.md §12 only defines
 * GET operations for positions. Writes happen indirectly through
 * transaction creation (FR-017), not yet implemented.
 *
 * Ownership is enforced by requiring the portfolio to belong to the
 * caller first (reusing the same 404-on-mismatch behavior already
 * established for portfolios), before listing anything scoped to it.
 */
export async function listPositions(userId: string, portfolioId: string): Promise<Position[]> {
  await getPortfolioById(userId, portfolioId);

  return positionRepository.listByPortfolioId(portfolioId);
}

export interface PositionDetail {
  position: Position;
  metrics: PositionMetrics;
}

/**
 * Returns a single position with its derived metrics.
 * Source: FR-013 (Position Detail), 07-api-spec.md §12.
 *
 * `allocation` is intentionally omitted from the response here, even
 * though 07-api-spec.md §12's example includes it. Per
 * position-metrics.ts's own scope note, allocation requires the
 * portfolio's total value and belongs to calculatePortfolioMetrics /
 * calculateAllocation — introducing that dependency here would be
 * premature ahead of the portfolio-level analytics/overview endpoint
 * this project hasn't built yet (NFR-070).
 *
 * Ownership is enforced the same way as listPositions: the position
 * must belong to a portfolio owned by the caller, otherwise this
 * resolves to 404 — never revealing whether the position exists at
 * all to an unauthorized caller.
 */
export async function getPositionById(
  userId: string,
  portfolioId: string,
  positionId: string,
): Promise<PositionDetail> {
  await getPortfolioById(userId, portfolioId);

  const position = await positionRepository.getById(positionId);

  if (position?.portfolioId !== portfolioId) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  // Not caught by the generic Invalid*Error -> 400 mapping in
  // error-handler.ts by design: PositionMetricsCalculationError
  // represents corrupted/inconsistent persisted data (a stored
  // position with zero cost basis, which validateNewPosition should
  // have prevented at creation time), not a malformed client request.
  // It falls through to the catch-all 500 INTERNAL_ERROR path.
  const metrics = calculatePositionMetrics(position);

  return { position, metrics };
}
