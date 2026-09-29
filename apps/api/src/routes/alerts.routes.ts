import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { createAlertRequestSchema, updateAlertRequestSchema } from "../schemas/alert.schema.js";
import {
  createAlertHandler,
  deleteAlertHandler,
  getAlertByIdHandler,
  listAlertsHandler,
  updateAlertHandler,
} from "../controllers/alerts.controller.js";

export const alertsRouter: ExpressRouter = Router();

alertsRouter.get("/api/v1/alerts", authenticate, listAlertsHandler);

alertsRouter.get("/api/v1/alerts/:alertId", authenticate, getAlertByIdHandler);

alertsRouter.post(
  "/api/v1/alerts",
  authenticate,
  validate(createAlertRequestSchema, "body"),
  createAlertHandler,
);

alertsRouter.patch(
  "/api/v1/alerts/:alertId",
  authenticate,
  validate(updateAlertRequestSchema, "body"),
  updateAlertHandler,
);

alertsRouter.delete("/api/v1/alerts/:alertId", authenticate, deleteAlertHandler);
