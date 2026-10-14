import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { allocationQuerySchema, portfolioIdParamsSchema } from "@trading/contracts";
import { makeAnalyticsController } from "../controllers/analytics.controller.js";
import { composition } from "../composition.js";

const { getPortfolioAllocationHandler, getPortfolioAttributionHandler } = makeAnalyticsController(
  composition.analyticsService,
);

export const analyticsRouter: ExpressRouter = Router();

analyticsRouter.get(
  "/api/v1/portfolios/:portfolioId/analytics/allocation",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  validate(allocationQuerySchema, "query"),
  getPortfolioAllocationHandler,
);

analyticsRouter.get(
  "/api/v1/portfolios/:portfolioId/analytics/attribution",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  getPortfolioAttributionHandler,
);
