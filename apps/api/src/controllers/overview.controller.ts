import type { NextFunction, Request, Response } from "express";
import { getPortfolioOverview } from "../services/overview.service.js";

/**
 * GET /api/v1/portfolios/:portfolioId/overview
 * Source: 07-api-spec.md §11 (Portfolio Overview), FR-004.
 */
export async function getPortfolioOverviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const overview = await getPortfolioOverview(req.auth.userId, req.params.portfolioId as string);
    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
}
