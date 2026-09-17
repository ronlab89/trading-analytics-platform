import { PrismaPortfolioRepository } from "@trading/database";
import type { Portfolio } from "@trading/database/generated/client/client";
import { validateNewPortfolio } from "../../../../packages/domain/src";

const portfolioRepository = new PrismaPortfolioRepository();

/**
 * Returns every portfolio owned by the given user.
 * Source: FR-008 (List Portfolios).
 *
 * Ownership is enforced by construction here, not by a separate check:
 * `listByUserId` can only ever return rows belonging to `userId`, so
 * there is no risk of leaking another user's portfolios through this
 * operation (09-security-spec.md §14, Resource Ownership).
 */
export async function listPortfolios(userId: string): Promise<Portfolio[]> {
  return portfolioRepository.listByUserId(userId);
}

export interface CreatePortfolioRequest {
  name: string;
  baseCurrency: string;
  description?: string;
}

/**
 * Creates a new portfolio owned by the given user.
 * Source: FR-009 (Create Portfolio).
 *
 * `userId` is always taken from the authenticated caller (req.auth),
 * never from the request body — a client must never be able to create
 * a portfolio on another user's behalf (09-security-spec.md §46,
 * Frontend Security Boundary: never trust client-supplied ownership).
 *
 * Runs `validateNewPortfolio` before touching the repository. Any
 * failure throws `InvalidPortfolioError`, which the centralized error
 * handler normalizes to 400 VALIDATION_ERROR by naming convention —
 * this service does not need to catch or translate it itself.
 */
export async function createPortfolio(
  userId: string,
  input: CreatePortfolioRequest,
): Promise<Portfolio> {
  const createInput = { userId, ...input };

  validateNewPortfolio(createInput);

  return portfolioRepository.create(createInput);
}
