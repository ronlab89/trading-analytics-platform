import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getPositionById, listPositions } from "../services/position.service.js";

export const positionsRouter: ExpressRouter = Router();

/**
 * GET /api/v1/portfolios/:portfolioId/positions
 * Source: 07-api-spec.md §12 (List Positions), FR-012.
 */
positionsRouter.get(
  "/api/v1/portfolios/:portfolioId/positions",
  authenticate,
  async (req, res, next) => {
    try {
      const positions = await listPositions(req.auth.userId, req.params.portfolioId as string);
      res.json({ data: positions });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/portfolios/:portfolioId/positions/:positionId
 * Source: 07-api-spec.md §12 (Get Position), FR-013.
 *
 * Response includes derived metrics alongside the raw position record
 * (see position.service.ts for why `allocation` is not included yet).
 */
positionsRouter.get(
  "/api/v1/portfolios/:portfolioId/positions/:positionId",
  authenticate,
  async (req, res, next) => {
    try {
      const { position, metrics } = await getPositionById(
        req.auth.userId,
        req.params.portfolioId as string,
        req.params.positionId as string,
      );
      res.json({ data: { position, metrics } });
    } catch (error) {
      next(error);
    }
  },
);
