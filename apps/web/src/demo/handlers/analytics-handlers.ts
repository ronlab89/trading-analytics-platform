import {
  presentAllocation,
  presentAttribution,
  presentOverview,
  presentPerformance,
  presentRangeAttribution,
  presentRisk,
} from "@trading/contracts";
import type {
  AnalyticsPeriodQuery,
  AttributionQuery,
  allocationQuerySchema,
} from "@trading/contracts";
import type { z } from "zod";
import type { HandlerContext, HandlerRegistry } from "./handler";

type AllocationQuery = z.infer<typeof allocationQuerySchema>;

interface PortfolioParams {
  readonly portfolioId: string;
}

/** Mirrors `analytics.controller.ts` and `overview.controller.ts` of the API, on the same services. */
export function createAnalyticsHandlers({ composition }: HandlerContext): HandlerRegistry {
  const {
    analyticsService,
    overviewService,
    riskService,
    performanceService,
    rangeAttributionService,
    actor,
  } = composition;

  return {
    getPortfolioOverview: async ({ params }) => {
      const { portfolioId } = params as PortfolioParams;
      return {
        data: presentOverview(await overviewService.getPortfolioOverview(actor, portfolioId)),
      };
    },
    getPortfolioAllocation: async ({ params, query }) => {
      const { portfolioId } = params as PortfolioParams;
      const { groupBy } = query as AllocationQuery;
      const result = await analyticsService.getPortfolioAllocation(actor, portfolioId, groupBy);
      return { data: presentAllocation(result) };
    },
    getPortfolioAttribution: async ({ params, query }) => {
      const { portfolioId } = params as PortfolioParams;
      const attribution = query as AttributionQuery;
      if (attribution.kind === "range") {
        const result = await rangeAttributionService.getRangeAttribution(
          actor,
          portfolioId,
          attribution.period,
          attribution.groupBy,
        );
        return { data: presentRangeAttribution(result) };
      }
      const result = await analyticsService.getPortfolioAttribution(actor, portfolioId);
      return { data: presentAttribution(result) };
    },
    getPortfolioRisk: async ({ params, query }) => {
      const { portfolioId } = params as PortfolioParams;
      const result = await riskService.getPortfolioRisk(
        actor,
        portfolioId,
        query as AnalyticsPeriodQuery,
      );
      return { data: presentRisk(result) };
    },
    getPortfolioPerformance: async ({ params, query }) => {
      const { portfolioId } = params as PortfolioParams;
      const result = await performanceService.getPortfolioPerformance(
        actor,
        portfolioId,
        query as AnalyticsPeriodQuery,
      );
      return { data: presentPerformance(result) };
    },
  };
}
