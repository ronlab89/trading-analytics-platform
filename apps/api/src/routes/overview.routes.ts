import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { portfolioIdParamsSchema } from "@trading/contracts";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { makeOverviewController } from "../controllers/overview.controller.js";
import { composition } from "../composition.js";

const { getPortfolioOverviewHandler } = makeOverviewController(composition.overviewService);

export const overviewRouter: ExpressRouter = Router();

overviewRouter.get(
  "/api/v1/portfolios/:portfolioId/overview",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  getPortfolioOverviewHandler,
);
