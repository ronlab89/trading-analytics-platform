import { PortfolioStatus, validateNewPortfolio } from "@trading/domain";
import type { Portfolio, PortfolioRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import { assertPortfolioWritable } from "./portfolio-guard.js";

export interface PortfolioServiceDependencies {
  portfolioRepository: PortfolioRepository;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

export interface CreatePortfolioRequest {
  name: string;
  baseCurrency: string;
  description?: string;
}

export interface UpdatePortfolioRequest {
  name?: string;
  description?: string;
}

export interface ArchivePortfolioResult {
  portfolio: Portfolio;
  alreadyArchived: boolean;
}

/**
 * Portfolio use cases.
 * Source: FR-008..FR-011, 07-api-spec.md §10, ADR-001 point 2.
 *
 * A factory that receives its dependencies and returns the use cases, with
 * no framework or database imports. Every use case checks the permission
 * first, then ownership.
 */
export function createPortfolioService(dependencies: PortfolioServiceDependencies) {
  const { portfolioRepository, permissions = ROLE_PERMISSIONS } = dependencies;

  /**
   * Returns every portfolio owned by the actor. Ownership holds by
   * construction: `listByUserId` can only return the actor's own rows
   * (09-security-spec.md §14).
   */
  async function listPortfolios(actor: Actor): Promise<Portfolio[]> {
    assertPermission(actor, "portfolio:read", permissions);
    return portfolioRepository.listByUserId(actor.userId);
  }

  /**
   * Returns one portfolio, scoped to its owner.
   *
   * A missing portfolio and one that belongs to someone else raise the same
   * `NotFoundError`, never a 403, so a caller cannot confirm that another
   * user's resource exists (09-security-spec.md §14-15).
   */
  async function getPortfolioById(actor: Actor, portfolioId: string): Promise<Portfolio> {
    assertPermission(actor, "portfolio:read", permissions);

    const portfolio = await portfolioRepository.getById(portfolioId);

    if (portfolio?.userId !== actor.userId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    return portfolio;
  }

  /**
   * Creates a portfolio owned by the actor. The owner always comes from the
   * actor, never from the request (09-security-spec.md §46). Domain
   * validation runs before the repository is touched; its
   * `InvalidPortfolioError` is mapped to 400 by the HTTP error handler.
   */
  async function createPortfolio(actor: Actor, input: CreatePortfolioRequest): Promise<Portfolio> {
    assertPermission(actor, "portfolio:write", permissions);

    const createInput = { userId: actor.userId, ...input };

    validateNewPortfolio(createInput);

    return portfolioRepository.create(createInput);
  }

  /**
   * Updates a portfolio's name and description. `baseCurrency` is immutable
   * after creation (05-data-model.md §43). Ownership is checked before any
   * write.
   */
  async function updatePortfolio(
    actor: Actor,
    portfolioId: string,
    input: UpdatePortfolioRequest,
  ): Promise<Portfolio> {
    assertPermission(actor, "portfolio:write", permissions);
    assertPortfolioWritable(await getPortfolioById(actor, portfolioId));

    // Rebuilt with conditional spreads: under `exactOptionalPropertyTypes` an
    // optional field must be omitted, never assigned `undefined`.
    const updateInput: Partial<Pick<Portfolio, "name" | "description">> = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    };

    return portfolioRepository.update(portfolioId, updateInput);
  }

  /**
   * Archives a portfolio: a status change, not a deletion (05-data-model.md
   * §6). Idempotent: archiving an archived portfolio is not an error, and
   * `alreadyArchived` tells the client whether this call changed anything.
   */
  async function archivePortfolio(
    actor: Actor,
    portfolioId: string,
  ): Promise<ArchivePortfolioResult> {
    assertPermission(actor, "portfolio:write", permissions);

    const existing = await getPortfolioById(actor, portfolioId);

    if (existing.status === PortfolioStatus.ARCHIVED) {
      return { portfolio: existing, alreadyArchived: true };
    }

    const portfolio = await portfolioRepository.update(portfolioId, {
      status: PortfolioStatus.ARCHIVED,
    });

    return { portfolio, alreadyArchived: false };
  }

  return { listPortfolios, getPortfolioById, createPortfolio, updatePortfolio, archivePortfolio };
}

export type PortfolioService = ReturnType<typeof createPortfolioService>;
