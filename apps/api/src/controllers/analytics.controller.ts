import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { allocationQuerySchema } from "../schemas/analytics.schema.js";
import { getPortfolioAllocation, getPortfolioAttribution } from "../services/analytics.service.js";

type AllocationQuery = z.infer<typeof allocationQuerySchema>;

/**
 * GET /api/v1/portfolios/:portfolioId/analytics/allocation
 * Source: 07-api-spec.md §20 (Allocation), FR-027.
 *
 * Query validated upstream by `validate(allocationQuerySchema, "query")`.
 */
export async function getPortfolioAllocationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { groupBy } = req.validated?.query as AllocationQuery;

  try {
    const result = await getPortfolioAllocation(
      req.auth.userId,
      req.params.portfolioId as string,
      groupBy,
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/portfolios/:portfolioId/analytics/attribution
 * Source: 07-api-spec.md §22 (Attribution), FR-030/FR-031.
 */
export async function getPortfolioAttributionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getPortfolioAttribution(req.auth.userId, req.params.portfolioId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
