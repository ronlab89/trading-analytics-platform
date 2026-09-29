import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { allocationQuerySchema } from "../schemas/analytics.schema.js";
import {
  getPortfolioAllocationHandler,
  getPortfolioAttributionHandler,
} from "../controllers/analytics.controller.js";

export const analyticsRouter: ExpressRouter = Router();

analyticsRouter.get(
  "/api/v1/portfolios/:portfolioId/analytics/allocation",
  authenticate,
  validate(allocationQuerySchema, "query"),
  getPortfolioAllocationHandler,
);

analyticsRouter.get(
  "/api/v1/portfolios/:portfolioId/analytics/attribution",
  authenticate,
  getPortfolioAttributionHandler,
);
