import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { allocationQuerySchema } from "../schemas/analytics.schema.js";
import { getPortfolioAllocation, getPortfolioAttribution } from "../services/analytics.service.js";
import { AppError } from "../errors/app-error.js";

export const analyticsRouter: ExpressRouter = Router();

/**
 * GET /api/v1/portfolios/:portfolioId/analytics/allocation
 * Source: 07-api-spec.md §20 (Allocation), FR-027.
 */
analyticsRouter.get(
  "/api/v1/portfolios/:portfolioId/analytics/allocation",
  authenticate,
  async (req, res, next) => {
    const parsedQuery = allocationQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      next(
        new AppError(
          "VALIDATION_ERROR",
          "The request contains invalid query parameters.",
          400,
          parsedQuery.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    try {
      const result = await getPortfolioAllocation(
        req.auth.userId,
        req.params.portfolioId as string,
        parsedQuery.data.groupBy,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/portfolios/:portfolioId/analytics/attribution
 * Source: 07-api-spec.md §22 (Attribution), FR-030/FR-031.
 */
analyticsRouter.get(
  "/api/v1/portfolios/:portfolioId/analytics/attribution",
  authenticate,
  async (req, res, next) => {
    try {
      const result = await getPortfolioAttribution(
        req.auth.userId,
        req.params.portfolioId as string,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
