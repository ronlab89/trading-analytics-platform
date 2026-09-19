import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getPortfolioOverview } from "../services/overview.service.js";

export const overviewRouter: ExpressRouter = Router();

/**
 * GET /api/v1/portfolios/:portfolioId/overview
 * Source: 07-api-spec.md §11 (Portfolio Overview), FR-004.
 */
overviewRouter.get(
  "/api/v1/portfolios/:portfolioId/overview",
  authenticate,
  async (req, res, next) => {
    try {
      const overview = await getPortfolioOverview(
        req.auth.userId,
        req.params.portfolioId as string,
      );
      res.json({ data: overview });
    } catch (error) {
      next(error);
    }
  },
);
