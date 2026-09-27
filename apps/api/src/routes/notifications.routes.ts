import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { listNotificationsQuerySchema } from "../schemas/notification.schema.js";
import {
  listNotificationsHandler,
  markAllNotificationsAsReadHandler,
  markNotificationAsReadHandler,
} from "../controllers/notifications.controller.js";

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
  markNotificationAsReadHandler,
);
