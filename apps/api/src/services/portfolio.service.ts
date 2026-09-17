import { PrismaPortfolioRepository } from "@trading/database";
import {
  PortfolioStatus,
  validateNewPortfolio,
  type Portfolio,
} from "../../../../packages/domain/src";
import { AppError } from "../errors/app-error";

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

/**
 * Returns a single portfolio, scoped to its owner.
 * Source: 07-api-spec.md §10 (Get Portfolio).
 *
 * Deliberately returns 404 NOT_FOUND both when the portfolio does not
 * exist and when it belongs to a different user, rather than 403
 * Forbidden. This avoids confirming the existence of another user's
 * resource to an unauthorized caller — the same anti-enumeration
 * principle already applied to login (09-security-spec.md §51, §14-15
 * Resource Ownership / IDOR Protection).
 */
export async function getPortfolioById(userId: string, portfolioId: string): Promise<Portfolio> {
  const portfolio = await portfolioRepository.getById(portfolioId);

  if (portfolio?.userId !== userId) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  return portfolio;
}

export interface UpdatePortfolioRequest {
  name?: string;
  description?: string;
}

/**
 * Updates a portfolio's mutable metadata (name/description only).
 * Source: 07-api-spec.md §10 (Update Portfolio), FR-010.
 *
 * `baseCurrency` is intentionally not accepted here — it is immutable
 * after creation (05-data-model.md §43, Historical Integrity: changing
 * it would silently invalidate historical valuations for portfolios
 * that already have transactions).
 *
 * Reuses `getPortfolioById` for the ownership check, so an update
 * attempt against a portfolio the caller does not own resolves to the
 * same 404 as a genuinely missing portfolio, before any write is
 * attempted.
 */
export async function updatePortfolio(
  userId: string,
  portfolioId: string,
  input: UpdatePortfolioRequest,
): Promise<Portfolio> {
  await getPortfolioById(userId, portfolioId);

  // Rebuilt via conditional spread rather than forwarding `input`
  // directly: under `exactOptionalPropertyTypes: true`, TypeScript
  // cannot reliably verify that the independently-declared
  // `UpdatePortfolioRequest` interface structurally matches the
  // repository's `Partial<Pick<Portfolio, ...>>` parameter type, even
  // though both only ever describe "optional, no explicit undefined".
  // Building a fresh object literal here sidesteps that mismatch.
  const updateInput: Partial<Pick<Portfolio, "name" | "description">> = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  };

  return portfolioRepository.update(portfolioId, updateInput);
}

export interface ArchivePortfolioResult {
  portfolio: Portfolio;
  alreadyArchived: boolean;
}

/**
 * Archives a portfolio (soft status transition, not deletion).
 * Source: 07-api-spec.md §10 (Archive Portfolio), FR-011.
 *
 * Archiving is modeled as a status change rather than a distinct
 * domain operation or destructive delete, per 05-data-model.md §6 and
 * the repository contract's own guidance (portfolio-repository.ts,
 * `update` doc comment: "application services should prefer
 * update(id, { status: 'ARCHIVED' })").
 *
 * Idempotent by design: archiving an already-archived portfolio is not
 * treated as an error (no 409 Conflict) — there is no meaningful
 * failure here, and forcing the client to special-case it would add
 * friction without benefit. Instead, `alreadyArchived` is returned so
 * the caller (typically the frontend) can choose the right feedback
 * message ("Portfolio archived" vs "This portfolio was already
 * archived") without the backend inventing an error code for a
 * non-error condition.
 */
export async function archivePortfolio(
  userId: string,
  portfolioId: string,
): Promise<ArchivePortfolioResult> {
  const existing = await getPortfolioById(userId, portfolioId);

  if (existing.status === PortfolioStatus.ARCHIVED) {
    return { portfolio: existing, alreadyArchived: true };
  }

  const portfolio = await portfolioRepository.update(portfolioId, {
    status: PortfolioStatus.ARCHIVED,
  });

  return { portfolio, alreadyArchived: false };
}
