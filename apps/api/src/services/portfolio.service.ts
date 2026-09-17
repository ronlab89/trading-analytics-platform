import { PrismaPortfolioRepository } from "@trading/database";
import type { Portfolio } from "@trading/database/generated/client/client";

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
