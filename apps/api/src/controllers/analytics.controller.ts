import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import {
  presentAllocation,
  presentAttribution,
  presentPerformance,
  presentRangeAttribution,
  presentRisk,
} from "@trading/contracts";
import type {
  AnalyticsPeriodQuery,
  AttributionQuery,
  allocationQuerySchema,
} from "@trading/contracts";
import type {
  AnalyticsService,
  PerformanceService,
  RangeAttributionService,
  RiskService,
} from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type AllocationQuery = z.infer<typeof allocationQuerySchema>;

/** Analytics HTTP handlers, bound to the analytics use cases they call. */
export function makeAnalyticsController(
  analyticsService: AnalyticsService,
  riskService: RiskService,
  performanceService: PerformanceService,
  rangeAttributionService: RangeAttributionService,
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
   *
   * Query validated upstream by `validate(attributionQuerySchema, "query")`. Without
   * range parameters it is the current-state attribution, unchanged; with any of
   * them it is the range attribution.
   */
  async function getPortfolioAttributionHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const query = req.validated?.query as AttributionQuery;

    try {
      if (query.kind === "range") {
        const result = await rangeAttributionService.getRangeAttribution(
          actorOf(req),
          req.params.portfolioId as string,
          query.period,
          query.groupBy,
        );
        res.json({ data: presentRangeAttribution(result) });
        return;
      }

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

  /**
   * GET /api/v1/portfolios/:portfolioId/analytics/performance
   * Source: 07-api-spec.md §20 (Performance), FR-025, FR-026.
   *
   * Query validated upstream by `validate(analyticsPeriodQuerySchema, "query")`.
   */
  async function getPortfolioPerformanceHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const query = req.validated?.query as AnalyticsPeriodQuery;

    try {
      const result = await performanceService.getPortfolioPerformance(
        actorOf(req),
        req.params.portfolioId as string,
        query,
      );
      res.json({ data: presentPerformance(result) });
    } catch (error) {
      next(error);
    }
  }

  return {
    getPortfolioAllocationHandler,
    getPortfolioAttributionHandler,
    getPortfolioRiskHandler,
    getPortfolioPerformanceHandler,
  };
}
