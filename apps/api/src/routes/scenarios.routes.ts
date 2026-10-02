import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { listScenariosQuerySchema } from "../schemas/scenario.schema.js";
import {
  calculateScenarioHandler,
  getScenarioByIdHandler,
  listScenariosHandler,
} from "../controllers/scenarios.controller.js";

export const scenariosRouter: ExpressRouter = Router();

scenariosRouter.get(
  "/api/v1/portfolios/:portfolioId/scenarios",
  authenticate,
  validate(listScenariosQuerySchema, "query"),
  listScenariosHandler,
);

scenariosRouter.get(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
  authenticate,
  getScenarioByIdHandler,
);

scenariosRouter.post(
  "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate",
  authenticate,
  calculateScenarioHandler,
);
