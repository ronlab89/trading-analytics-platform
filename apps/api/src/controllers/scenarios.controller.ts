import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { listScenariosQuerySchema } from "../schemas/scenario.schema.js";
import { calculateScenario, getScenarioById, listScenarios } from "../services/scenario.service.js";

type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;

/**
 * GET /api/v1/portfolios/:portfolioId/scenarios
 * Source: 07-api-spec.md §25 (List Scenarios).
 *
 * Query validated upstream by `validate(listScenariosQuerySchema, "query")`.
 */
export async function listScenariosHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { status } = req.validated?.query as ListScenariosQuery;

  try {
    const scenarios = await listScenarios(req.auth.userId, req.params.portfolioId as string, {
      ...(status !== undefined ? { status } : {}),
    });
    res.json({ data: scenarios });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
 */
export async function getScenarioByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const scenario = await getScenarioById(
      req.auth.userId,
      req.params.portfolioId as string,
      req.params.scenarioId as string,
    );
    res.json({ data: scenario });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate
 * Source: 07-api-spec.md §25 (Calculate Scenario), FR-038.
 *
 * No request body: the scenario's stored changes and the portfolio's
 * current positions are the inputs. Nothing is written.
 */
export async function calculateScenarioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await calculateScenario(
      req.auth.userId,
      req.params.portfolioId as string,
      req.params.scenarioId as string,
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
