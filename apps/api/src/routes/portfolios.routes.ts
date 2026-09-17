import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { createPortfolioRequestSchema } from "../schemas/portfolio.schema.js";
import { createPortfolio, listPortfolios } from "../services/portfolio.service.js";
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
