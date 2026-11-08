import { calculatePositionMetrics } from "@trading/domain";
import type { Position, PositionMetrics, PositionRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

export interface PositionServiceDependencies {
  positionRepository: Pick<PositionRepository, "listByPortfolioId" | "getById">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

export interface PositionDetail {
  position: Position;
  metrics: PositionMetrics;
}

/**
 * Position use cases (read-only).
 * Source: FR-012, FR-013, 07-api-spec.md §12.
 *
 * A Position is a materialized projection of transaction history
 * (05-data-model.md §8): it is written only by transaction creation, never
 * directly. Ownership is enforced through the portfolio first, so a position
 * of another user's portfolio is indistinguishable from a missing one.
 */
export function createPositionService(dependencies: PositionServiceDependencies) {
  const { positionRepository, portfolioService, permissions = ROLE_PERMISSIONS } = dependencies;

  /** Returns every position held by one of the actor's portfolios. */
  async function listPositions(actor: Actor, portfolioId: string): Promise<Position[]> {
    assertPermission(actor, "position:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    return positionRepository.listByPortfolioId(portfolioId);
  }

  /**
   * Returns one position with its derived metrics. `allocation` is left out:
   * it needs the portfolio's total value and belongs to the portfolio-level
   * overview (NFR-070).
   */
  async function getPositionById(
    actor: Actor,
    portfolioId: string,
    positionId: string,
  ): Promise<PositionDetail> {
    assertPermission(actor, "position:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    const position = await positionRepository.getById(positionId);

    if (position?.portfolioId !== portfolioId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    // `PositionMetricsCalculationError` means corrupted persisted data, not a
    // bad request: it is deliberately not mapped to 4xx and surfaces as 500.
    const metrics = calculatePositionMetrics(position);

    return { position, metrics };
  }

  return { listPositions, getPositionById };
}

export type PositionService = ReturnType<typeof createPositionService>;
