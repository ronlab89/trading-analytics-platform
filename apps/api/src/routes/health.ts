import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { livenessHandler, readinessHandler } from "../controllers/health.controller.js";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/health", livenessHandler);

healthRouter.get("/health/ready", readinessHandler);
