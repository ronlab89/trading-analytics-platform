import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createPortfolioRequestSchema,
  updatePortfolioRequestSchema,
} from "../schemas/portfolio.schema.js";
import {
  createPortfolio,
  getPortfolioById,
  listPortfolios,
  updatePortfolio,
} from "../services/portfolio.service.js";
import { AppError } from "../errors/app-error.js";

export const portfoliosRouter: ExpressRouter = Router();

/**
 * GET /api/v1/portfolios
 * Source: 07-api-spec.md §10 (List Portfolios), FR-008.
 *
 * Always scoped to the authenticated caller — there is no "list all
 * portfolios" operation exposed by this API.
 */
portfoliosRouter.get("/api/v1/portfolios", authenticate, async (req, res, next) => {
  try {
    const portfolios = await listPortfolios(req.auth.userId);
    res.json({ data: portfolios });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/portfolios
 * Source: 07-api-spec.md §10 (Create Portfolio), FR-009.
 */
portfoliosRouter.post("/api/v1/portfolios", authenticate, async (req, res, next) => {
  const parsed = createPortfolioRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    next(
      new AppError(
        "VALIDATION_ERROR",
        "The request contains invalid fields.",
        400,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      ),
    );
    return;
  }

  const { name, baseCurrency, description } = parsed.data;

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
});

/**
 * GET /api/v1/portfolios/:portfolioId
 * Source: 07-api-spec.md §10 (Get Portfolio), FR-008.
 *
 * Ownership is enforced in the service layer: a portfolio belonging to
 * another user resolves to 404, identically to a non-existent
 * portfolio (09-security-spec.md §14-15, IDOR Protection).
 */
portfoliosRouter.get("/api/v1/portfolios/:portfolioId", authenticate, async (req, res, next) => {
  try {
    const portfolio = await getPortfolioById(req.auth.userId, req.params.portfolioId as string);
    res.json({ data: portfolio });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/portfolios/:portfolioId
 * Source: 07-api-spec.md §10 (Update Portfolio), FR-010.
 *
 * Only `name` and `description` are editable — see
 * updatePortfolioRequestSchema for the rationale on excluding
 * `baseCurrency`. Ownership is enforced the same way as GET by id.
 */
portfoliosRouter.patch("/api/v1/portfolios/:portfolioId", authenticate, async (req, res, next) => {
  const parsed = updatePortfolioRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    next(
      new AppError(
        "VALIDATION_ERROR",
        "The request contains invalid fields.",
        400,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      ),
    );
    return;
  }

  const { name, description } = parsed.data;

  try {
    const portfolio = await updatePortfolio(req.auth.userId, req.params.portfolioId as string, {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    });
    res.json({ data: portfolio });
  } catch (error) {
    next(error);
  }
});
