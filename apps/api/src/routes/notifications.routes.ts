import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { listNotificationsQuerySchema, notificationIdParamsSchema } from "@trading/contracts";
import { makeNotificationsController } from "../controllers/notifications.controller.js";
import { composition } from "../composition.js";

const {
  listNotificationsHandler,
  markAllNotificationsAsReadHandler,
  markNotificationAsReadHandler,
} = makeNotificationsController(composition.notificationService);

export const notificationsRouter: ExpressRouter = Router();

notificationsRouter.get(
  "/api/v1/notifications",
  authenticate,
  validate(listNotificationsQuerySchema, "query"),
  listNotificationsHandler,
);

notificationsRouter.post(
  "/api/v1/notifications/read-all",
  authenticate,
  markAllNotificationsAsReadHandler,
);

notificationsRouter.post(
  "/api/v1/notifications/:notificationId/read",
  authenticate,
  validate(notificationIdParamsSchema, "params"),
  markNotificationAsReadHandler,
);
