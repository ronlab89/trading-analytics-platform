import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { presentAllocation, presentAttribution, presentRisk } from "@trading/contracts";
import type { AnalyticsPeriodQuery, allocationQuerySchema } from "@trading/contracts";
import type { AnalyticsService, RiskService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type AllocationQuery = z.infer<typeof allocationQuerySchema>;

/** Analytics HTTP handlers, bound to the analytics use cases they call. */
export function makeAnalyticsController(
  analyticsService: AnalyticsService,
  riskService: RiskService,
) {
  /**
   * GET /api/v1/portfolios/:portfolioId/analytics/allocation
   * Source: 07-api-spec.md §20 (Allocation), FR-027.
   *
   * Query validated upstream by `validate(allocationQuerySchema, "query")`.
   */
  async function getPortfolioAllocationHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { groupBy } = req.validated?.query as AllocationQuery;

    try {
      const result = await analyticsService.getPortfolioAllocation(
        actorOf(req),
        req.params.portfolioId as string,
        groupBy,
      );
      res.json({ data: presentAllocation(result) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolios/:portfolioId/analytics/attribution
   * Source: 07-api-spec.md §22 (Attribution), FR-030/FR-031.
   */
  async function getPortfolioAttributionHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await analyticsService.getPortfolioAttribution(
        actorOf(req),
        req.params.portfolioId as string,
      );
      res.json({ data: presentAttribution(result) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolios/:portfolioId/analytics/risk
   * Source: 07-api-spec.md §20 (Risk), FR-028, FR-029.
   *
   * Query validated upstream by `validate(analyticsPeriodQuerySchema, "query")`.
   */
  async function getPortfolioRiskHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const query = req.validated?.query as AnalyticsPeriodQuery;

    try {
      const result = await riskService.getPortfolioRisk(
        actorOf(req),
        req.params.portfolioId as string,
        query,
      );
      res.json({ data: presentRisk(result) });
    } catch (error) {
      next(error);
    }
  }

  return { getPortfolioAllocationHandler, getPortfolioAttributionHandler, getPortfolioRiskHandler };
}
