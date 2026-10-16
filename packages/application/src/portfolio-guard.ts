import { PortfolioStatus } from "@trading/domain";
import type { Portfolio } from "@trading/domain";
import { ConflictError } from "./errors.js";

/**
 * Archived-portfolio guard.
 * Source: ADR-010 point 5, FR-011, docs/BACKEND-ROADMAP.md B0.
 *
 * An archived portfolio is read-only: any mutation scoped to it is rejected
 * with a `ConflictError` (409 `CONFLICT`) before anything is written. Call it
 * right after the ownership check, so a portfolio of another user still
 * reads as missing (404) and never reveals that it is archived. Reads and the
 * archive call itself do not use it.
 */
export function assertPortfolioWritable(portfolio: Pick<Portfolio, "status">): void {
  if (portfolio.status === PortfolioStatus.ARCHIVED) {
    throw new ConflictError("An archived portfolio cannot be modified.");
  }
}
