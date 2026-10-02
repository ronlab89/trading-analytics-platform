import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type {
  createScenarioRequestSchema,
  listScenariosQuerySchema,
  updateScenarioRequestSchema,
} from "../schemas/scenario.schema.js";
import {
  archiveScenario,
  calculateScenario,
  createScenario,
  deleteScenario,
  getScenarioById,
  listScenarios,
  updateScenario,
} from "../services/scenario.service.js";

type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;
type CreateScenarioRequestBody = z.infer<typeof createScenarioRequestSchema>;
type UpdateScenarioRequestBody = z.infer<typeof updateScenarioRequestSchema>;

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

/**
 * POST /api/v1/portfolios/:portfolioId/scenarios
 * Source: 07-api-spec.md §25 (Create Scenario), FR-036.
 *
 * Body validated upstream by `validate(createScenarioRequestSchema, "body")`.
 */
export async function createScenarioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { name, description, changes } = req.validated?.body as CreateScenarioRequestBody;

  try {
    const scenario = await createScenario(req.auth.userId, req.params.portfolioId as string, {
      name,
      ...(description !== undefined ? { description } : {}),
      ...(changes !== undefined ? { changes } : {}),
    });
    res.status(201).json({ data: scenario });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
 * Source: 07-api-spec.md §25 (Update Scenario), FR-037, FR-039, FR-040.
 *
 * Body validated upstream by `validate(updateScenarioRequestSchema, "body")`.
 */
export async function updateScenarioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { name, description, status, changes } = req.validated?.body as UpdateScenarioRequestBody;

  try {
    const scenario = await updateScenario(
      req.auth.userId,
      req.params.portfolioId as string,
      req.params.scenarioId as string,
      {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(changes !== undefined ? { changes } : {}),
      },
    );
    res.json({ data: scenario });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive
 * Source: 07-api-spec.md §25 (Archive Scenario).
 *
 * Idempotent: always 200; `meta.alreadyArchived` says whether this call
 * changed anything (same convention as archiving a portfolio).
 */
export async function archiveScenarioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { scenario, alreadyArchived } = await archiveScenario(
      req.auth.userId,
      req.params.portfolioId as string,
      req.params.scenarioId as string,
    );
    res.json({ data: scenario, meta: { alreadyArchived } });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
 * Source: FR-043 (Delete Scenario).
 */
export async function deleteScenarioHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteScenario(
      req.auth.userId,
      req.params.portfolioId as string,
      req.params.scenarioId as string,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
