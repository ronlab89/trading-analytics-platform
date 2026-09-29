import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getPortfolioOverviewHandler } from "../controllers/overview.controller.js";

export const overviewRouter: ExpressRouter = Router();

overviewRouter.get(
  "/api/v1/portfolios/:portfolioId/overview",
  authenticate,
  getPortfolioOverviewHandler,
);
