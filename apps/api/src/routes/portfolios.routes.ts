import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { listPortfolios } from "../services/portfolio.service.js";

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
