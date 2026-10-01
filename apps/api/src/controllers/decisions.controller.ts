import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { listDecisionsQuerySchema } from "../schemas/decision.schema.js";
import { getDecisionById, getDecisionReplay, listDecisions } from "../services/decision.service.js";

type ListDecisionsQuery = z.infer<typeof listDecisionsQuerySchema>;

/**
 * GET /api/v1/portfolios/:portfolioId/decisions
 * Source: 07-api-spec.md §23 (List Decisions), FR-032.
 *
 * Query validated upstream by `validate(listDecisionsQuerySchema, "query")`.
 * Not paginated: see decision.schema.ts.
 */
export async function listDecisionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { assetId, direction, dateFrom, dateTo } = req.validated?.query as ListDecisionsQuery;

  try {
    const decisions = await listDecisions(req.auth.userId, req.params.portfolioId as string, {
      ...(assetId !== undefined ? { assetId } : {}),
      ...(direction !== undefined ? { direction } : {}),
      ...(dateFrom !== undefined ? { dateFrom } : {}),
      ...(dateTo !== undefined ? { dateTo } : {}),
    });
    res.json({ data: decisions });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/portfolios/:portfolioId/decisions/:decisionId
 * Source: 07-api-spec.md §23 (Get Decision), FR-033.
 */
export async function getDecisionByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const decision = await getDecisionById(
      req.auth.userId,
      req.params.portfolioId as string,
      req.params.decisionId as string,
    );
    res.json({ data: decision });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/decisions/:decisionId/replay
 * Source: 07-api-spec.md §24 (Get Replay Timeline), FR-034.
 */
export async function getDecisionReplayHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const replay = await getDecisionReplay(req.auth.userId, req.params.decisionId as string);
    res.json({ data: replay });
  } catch (error) {
    next(error);
  }
}
