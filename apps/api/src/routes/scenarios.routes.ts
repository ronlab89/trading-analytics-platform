import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  compareScenariosRequestSchema,
  createScenarioRequestSchema,
  listScenariosQuerySchema,
  updateScenarioRequestSchema,
} from "../schemas/scenario.schema.js";
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
  validate(listScenariosQuerySchema, "query"),
  listScenariosHandler,
);

scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios",
  authenticate,
  validate(createScenarioRequestSchema, "body"),
  createScenarioHandler,
);

// A fixed path segment, so it cannot be mistaken for a :scenarioId.
scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios/compare",
  authenticate,
  validate(compareScenariosRequestSchema, "body"),
  compareScenariosHandler,
);

scenariosRouter.get(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
  authenticate,
  getScenarioByIdHandler,
);

scenariosRouter.patch(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
  authenticate,
  validate(updateScenarioRequestSchema, "body"),
  updateScenarioHandler,
);

scenariosRouter.delete(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
  authenticate,
  deleteScenarioHandler,
);

scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive",
  authenticate,
  archiveScenarioHandler,
);

scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate",
  authenticate,
  calculateScenarioHandler,
);
