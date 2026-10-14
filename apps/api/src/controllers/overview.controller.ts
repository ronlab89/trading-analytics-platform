import type { NextFunction, Request, Response } from "express";
import { presentOverview } from "@trading/contracts";
import type { OverviewService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

/** Overview HTTP handlers, bound to the overview use case they call. */
export function makeOverviewController(overviewService: OverviewService) {
  /**
   * GET /api/v1/portfolios/:portfolioId/overview
   * Source: 07-api-spec.md §11 (Portfolio Overview), FR-004.
   */
  async function getPortfolioOverviewHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const overview = await overviewService.getPortfolioOverview(
        actorOf(req),
        req.params.portfolioId as string,
      );
      res.json({ data: presentOverview(overview) });
    } catch (error) {
      next(error);
    }
  }

  return { getPortfolioOverviewHandler };
}
