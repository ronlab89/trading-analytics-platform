import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { presentDecision, presentDecisionReplay } from "@trading/contracts";
import type { listDecisionsQuerySchema } from "@trading/contracts";
import type { DecisionService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type ListDecisionsQuery = z.infer<typeof listDecisionsQuerySchema>;

/** Decision HTTP handlers, bound to the decision use cases they call. */
export function makeDecisionsController(decisionService: DecisionService) {
  /**
   * GET /api/v1/portfolios/:portfolioId/decisions
   * Source: 07-api-spec.md §23 (List Decisions), FR-032.
   *
   * Query validated upstream by `validate(listDecisionsQuerySchema, "query")`.
   * Not paginated: see decision.schema.ts.
   */
  async function listDecisionsHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { assetId, direction, dateFrom, dateTo } = req.validated?.query as ListDecisionsQuery;

    try {
      const decisions = await decisionService.listDecisions(
        actorOf(req),
        req.params.portfolioId as string,
        {
          ...(assetId !== undefined ? { assetId } : {}),
          ...(direction !== undefined ? { direction } : {}),
          ...(dateFrom !== undefined ? { dateFrom } : {}),
          ...(dateTo !== undefined ? { dateTo } : {}),
        },
      );
      res.json({ data: decisions.map(presentDecision) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolios/:portfolioId/decisions/:decisionId
   * Source: 07-api-spec.md §23 (Get Decision), FR-033.
   */
  async function getDecisionByIdHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const decision = await decisionService.getDecisionById(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.decisionId as string,
      );
      res.json({ data: presentDecision(decision) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/decisions/:decisionId/replay
   * Source: 07-api-spec.md §24 (Get Replay Timeline), FR-034.
   */
  async function getDecisionReplayHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const replay = await decisionService.getDecisionReplay(
        actorOf(req),
        req.params.decisionId as string,
      );
      res.json({ data: presentDecisionReplay(replay) });
    } catch (error) {
      next(error);
    }
  }

  return { listDecisionsHandler, getDecisionByIdHandler, getDecisionReplayHandler };
}
