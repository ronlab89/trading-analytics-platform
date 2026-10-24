import type { NextFunction, Request, Response } from "express";
import type { SimulationService } from "@trading/application";
import { presentSimulationStatus } from "@trading/contracts";
import type { SimulationModeRequestBody } from "@trading/contracts";
import { actorOf } from "../middleware/authenticate.js";

/** Simulation control HTTP handlers, bound to the use cases they call. */
export function makeSimulationController(simulationService: SimulationService) {
  /**
   * POST /api/v1/simulation/start
   * Source: ADR-007 points 10 and 16, 08-realtime-spec.md §41.
   *
   * `HALTED` to `RUNNING`; answers the status, also when it already ran.
   */
  function startSimulationHandler(req: Request, res: Response, next: NextFunction): void {
    try {
      const status = simulationService.startSimulation(actorOf(req));
      res.json({ data: presentSimulationStatus(status) });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/simulation/pause: `RUNNING` to `HALTED`. */
  function pauseSimulationHandler(req: Request, res: Response, next: NextFunction): void {
    try {
      const status = simulationService.pauseSimulation(actorOf(req));
      res.json({ data: presentSimulationStatus(status) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/simulation/mode
   *
   * Body validated upstream by `validate(simulationModeRequestSchema, "body")`.
   */
  function changeSimulationModeHandler(req: Request, res: Response, next: NextFunction): void {
    try {
      const { mode } = req.validated?.body as SimulationModeRequestBody;
      const status = simulationService.changeSimulationMode(actorOf(req), mode);
      res.json({ data: presentSimulationStatus(status) });
    } catch (error) {
      next(error);
    }
  }

  return { startSimulationHandler, pauseSimulationHandler, changeSimulationModeHandler };
}
