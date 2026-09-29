import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type {
  createPortfolioRequestSchema,
  updatePortfolioRequestSchema,
} from "../schemas/portfolio.schema.js";
import {
  archivePortfolio,
  createPortfolio,
  getPortfolioById,
  listPortfolios,
  updatePortfolio,
} from "../services/portfolio.service.js";

type CreatePortfolioRequestBody = z.infer<typeof createPortfolioRequestSchema>;
type UpdatePortfolioRequestBody = z.infer<typeof updatePortfolioRequestSchema>;

/**
 * GET /api/v1/portfolios
 * Source: 07-api-spec.md §10 (List Portfolios), FR-008.
 *
 * Always scoped to the authenticated caller — there is no "list all
 * portfolios" operation exposed by this API.
 */
export async function listPortfoliosHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const portfolios = await listPortfolios(req.auth.userId);
    res.json({ data: portfolios });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/portfolios
 * Source: 07-api-spec.md §10 (Create Portfolio), FR-009.
 *
 * Body validated upstream by `validate(createPortfolioRequestSchema, "body")`.
 */
export async function createPortfolioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { name, baseCurrency, description } = req.validated?.body as CreatePortfolioRequestBody;

  try {
    // Conditional spread instead of passing `description` straight
    // through: with `exactOptionalPropertyTypes: true`, an optional
    // field must be omitted entirely when absent, never assigned
    // `undefined` explicitly (same pattern already established in
    // error-handler.ts for AppError.details).
    const portfolio = await createPortfolio(req.auth.userId, {
      name,
      baseCurrency,
      ...(description !== undefined ? { description } : {}),
    });
    res.status(201).json({ data: portfolio });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/portfolios/:portfolioId
 * Source: 07-api-spec.md §10 (Get Portfolio), FR-008.
 *
 * Ownership is enforced in the service layer: a portfolio belonging to
 * another user resolves to 404, identically to a non-existent
 * portfolio (09-security-spec.md §14-15, IDOR Protection).
 */
export async function getPortfolioByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const portfolio = await getPortfolioById(req.auth.userId, req.params.portfolioId as string);
    res.json({ data: portfolio });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/portfolios/:portfolioId
 * Source: 07-api-spec.md §10 (Update Portfolio), FR-010.
 *
 * Only `name` and `description` are editable — see
 * updatePortfolioRequestSchema for the rationale on excluding
 * `baseCurrency`. Ownership is enforced the same way as GET by id.
 *
 * Body validated upstream by `validate(updatePortfolioRequestSchema, "body")`.
 */
export async function updatePortfolioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { name, description } = req.validated?.body as UpdatePortfolioRequestBody;

  try {
    const portfolio = await updatePortfolio(req.auth.userId, req.params.portfolioId as string, {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    });
    res.json({ data: portfolio });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/portfolios/:portfolioId/archive
 * Source: 07-api-spec.md §10 (Archive Portfolio), FR-011.
 *
 * Idempotent: always returns 200, never 409. `meta.alreadyArchived`
 * tells the caller whether this call actually changed anything, so the
 * frontend can show the appropriate feedback (see portfolio.service.ts
 * for the full rationale).
 */
export async function archivePortfolioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { portfolio, alreadyArchived } = await archivePortfolio(
      req.auth.userId,
      req.params.portfolioId as string,
    );
    res.json({ data: portfolio, meta: { alreadyArchived } });
  } catch (error) {
    next(error);
  }
}
