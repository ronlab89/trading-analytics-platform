import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getPositionByIdHandler,
  listPositionsHandler,
} from "../controllers/positions.controller.js";

export const positionsRouter: ExpressRouter = Router();

positionsRouter.get(
  "/api/v1/portfolios/:portfolioId/positions",
  authenticate,
  listPositionsHandler,
);

positionsRouter.get(
  "/api/v1/portfolios/:portfolioId/positions/:positionId",
  authenticate,
  getPositionByIdHandler,
);
