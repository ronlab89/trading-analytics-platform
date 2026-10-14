import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import {
  presentScenario,
  presentScenarioCalculation,
  presentScenarioComparison,
} from "@trading/contracts";
import type {
  compareScenariosRequestSchema,
  createScenarioRequestSchema,
  listScenariosQuerySchema,
  updateScenarioRequestSchema,
} from "@trading/contracts";
import type { ScenarioService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;
type CreateScenarioRequestBody = z.infer<typeof createScenarioRequestSchema>;
type UpdateScenarioRequestBody = z.infer<typeof updateScenarioRequestSchema>;
type CompareScenariosRequestBody = z.infer<typeof compareScenariosRequestSchema>;

/** Scenario HTTP handlers, bound to the scenario use cases they call. */
export function makeScenariosController(scenarioService: ScenarioService) {
  /**
   * GET /api/v1/portfolios/:portfolioId/scenarios
   * Source: 07-api-spec.md §25 (List Scenarios).
   *
   * Query validated upstream by `validate(listScenariosQuerySchema, "query")`.
   */
  async function listScenariosHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { status } = req.validated?.query as ListScenariosQuery;

    try {
      const scenarios = await scenarioService.listScenarios(
        actorOf(req),
        req.params.portfolioId as string,
        { ...(status !== undefined ? { status } : {}) },
      );
      res.json({ data: scenarios.map(presentScenario) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
   */
  async function getScenarioByIdHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const scenario = await scenarioService.getScenarioById(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.scenarioId as string,
      );
      res.json({ data: presentScenario(scenario) });
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
  async function calculateScenarioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await scenarioService.calculateScenario(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.scenarioId as string,
      );
      res.json({ data: presentScenarioCalculation(result) });
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
  async function createScenarioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { name, description, changes } = req.validated?.body as CreateScenarioRequestBody;

    try {
      const scenario = await scenarioService.createScenario(
        actorOf(req),
        req.params.portfolioId as string,
        {
          name,
          ...(description !== undefined ? { description } : {}),
          ...(changes !== undefined ? { changes } : {}),
        },
      );
      res.status(201).json({ data: presentScenario(scenario) });
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
  async function updateScenarioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { name, description, status, changes } = req.validated?.body as UpdateScenarioRequestBody;

    try {
      const scenario = await scenarioService.updateScenario(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.scenarioId as string,
        {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(changes !== undefined ? { changes } : {}),
        },
      );
      res.json({ data: presentScenario(scenario) });
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
  async function archiveScenarioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { scenario, alreadyArchived } = await scenarioService.archiveScenario(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.scenarioId as string,
      );
      res.json({ data: presentScenario(scenario), meta: { alreadyArchived } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
   * Source: FR-043 (Delete Scenario).
   */
  async function deleteScenarioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await scenarioService.deleteScenario(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.scenarioId as string,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portfolios/:portfolioId/scenarios/compare
   * Source: FR-042 (Compare Scenarios), 01-product-spec.md §15.2.
   *
   * Body validated upstream by `validate(compareScenariosRequestSchema, "body")`.
   * Read-only: answers 200 and writes nothing.
   */
  async function compareScenariosHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { scenarioIds } = req.validated?.body as CompareScenariosRequestBody;

    try {
      const comparison = await scenarioService.compareScenarios(
        actorOf(req),
        req.params.portfolioId as string,
        scenarioIds,
      );
      res.json({ data: presentScenarioComparison(comparison) });
    } catch (error) {
      next(error);
    }
  }

  return {
    listScenariosHandler,
    getScenarioByIdHandler,
    calculateScenarioHandler,
    createScenarioHandler,
    updateScenarioHandler,
    archiveScenarioHandler,
    deleteScenarioHandler,
    compareScenariosHandler,
  };
}
