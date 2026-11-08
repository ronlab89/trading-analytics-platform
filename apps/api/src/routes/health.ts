import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { createReadinessHandler, livenessHandler } from "../controllers/health.controller.js";

/**
 * `isShuttingDown` comes from the shutdown sequence (`lifecycle/shutdown.ts`);
 * without it the process is never shutting down, as in tests.
 */
export function createHealthRouter(isShuttingDown: () => boolean = () => false): ExpressRouter {
  const router = Router();

  router.get("/health", livenessHandler);

  router.get("/health/ready", createReadinessHandler(isShuttingDown));

  return router;
}
