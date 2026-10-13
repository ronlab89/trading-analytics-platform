import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { portfolioIdParamsSchema, portfolioPositionParamsSchema } from "@trading/contracts";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getPositionByIdHandler,
  listPositionsHandler,
} from "../controllers/positions.controller.js";

export const positionsRouter: ExpressRouter = Router();

positionsRouter.get(
  "/api/v1/portfolios/:portfolioId/positions",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  listPositionsHandler,
);

positionsRouter.get(
  "/api/v1/portfolios/:portfolioId/positions/:positionId",
  authenticate,
  validate(portfolioPositionParamsSchema, "params"),
  getPositionByIdHandler,
);
