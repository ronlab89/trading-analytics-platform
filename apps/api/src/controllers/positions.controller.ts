import type { NextFunction, Request, Response } from "express";
import { presentPosition, presentPositionDetail } from "@trading/contracts";
import type { PositionService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

/** Position HTTP handlers, bound to the position use cases they call. */
export function makePositionsController(positionService: PositionService) {
  /**
   * GET /api/v1/portfolios/:portfolioId/positions
   * Source: 07-api-spec.md §12 (List Positions), FR-012.
   */
  async function listPositionsHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const positions = await positionService.listPositions(
        actorOf(req),
        req.params.portfolioId as string,
      );
      res.json({ data: positions.map(presentPosition) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolios/:portfolioId/positions/:positionId
   * Source: 07-api-spec.md §12 (Get Position), FR-013.
   *
   * Response includes derived metrics alongside the raw position record
   * (see position-service.ts for why `allocation` is not included yet).
   */
  async function getPositionByIdHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const detail = await positionService.getPositionById(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.positionId as string,
      );
      res.json({ data: presentPositionDetail(detail) });
    } catch (error) {
      next(error);
    }
  }

  return { listPositionsHandler, getPositionByIdHandler };
}
