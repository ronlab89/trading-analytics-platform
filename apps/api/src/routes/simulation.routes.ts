import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { simulationModeRequestSchema } from "@trading/contracts";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { makeSimulationController } from "../controllers/simulation.controller.js";
import { composition } from "../composition.js";

const { startSimulationHandler, pauseSimulationHandler, changeSimulationModeHandler } =
  makeSimulationController(composition.simulationService);

export const simulationRouter: ExpressRouter = Router();

simulationRouter.post("/api/v1/simulation/start", authenticate, startSimulationHandler);

simulationRouter.post("/api/v1/simulation/pause", authenticate, pauseSimulationHandler);

simulationRouter.put(
  "/api/v1/simulation/mode",
  authenticate,
  validate(simulationModeRequestSchema, "body"),
  changeSimulationModeHandler,
);
