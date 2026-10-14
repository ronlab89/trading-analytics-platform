import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  compareScenariosRequestSchema,
  createScenarioRequestSchema,
  listScenariosQuerySchema,
  portfolioIdParamsSchema,
  portfolioScenarioParamsSchema,
  updateScenarioRequestSchema,
} from "@trading/contracts";
import {
  archiveScenarioHandler,
  calculateScenarioHandler,
  compareScenariosHandler,
  createScenarioHandler,
  deleteScenarioHandler,
  getScenarioByIdHandler,
  listScenariosHandler,
  updateScenarioHandler,
} from "../controllers/scenarios.controller.js";

export const scenariosRouter: ExpressRouter = Router();

scenariosRouter.get(
  "/api/v1/portfolios/:portfolioId/scenarios",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  validate(listScenariosQuerySchema, "query"),
  listScenariosHandler,
);

scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  validate(createScenarioRequestSchema, "body"),
  createScenarioHandler,
);

// A fixed path segment, so it cannot be mistaken for a :scenarioId.
scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios/compare",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  validate(compareScenariosRequestSchema, "body"),
  compareScenariosHandler,
);

scenariosRouter.get(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
  authenticate,
  validate(portfolioScenarioParamsSchema, "params"),
  getScenarioByIdHandler,
);

scenariosRouter.patch(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
  authenticate,
  validate(portfolioScenarioParamsSchema, "params"),
  validate(updateScenarioRequestSchema, "body"),
  updateScenarioHandler,
);

scenariosRouter.delete(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
  authenticate,
  validate(portfolioScenarioParamsSchema, "params"),
  deleteScenarioHandler,
);

scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive",
  authenticate,
  validate(portfolioScenarioParamsSchema, "params"),
  archiveScenarioHandler,
);

scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate",
  authenticate,
  validate(portfolioScenarioParamsSchema, "params"),
  calculateScenarioHandler,
);
