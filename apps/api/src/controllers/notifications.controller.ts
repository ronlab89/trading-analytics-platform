import type { NextFunction, Request, Response } from "express";
import type { ListNotificationsQuery } from "../schemas/notification.schema.js";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notification.service.js";

/**
 * GET /api/v1/notifications
 * Source: 07-api-spec.md §28 (List Notifications), FR-051.
 *
 * Query validated upstream by `validate(listNotificationsQuerySchema, "query")`.
 */
export async function listNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { unreadOnly } = req.validated?.query as ListNotificationsQuery;

  try {
    const notifications = await listNotifications(req.auth.userId, { unreadOnly });
    res.json({ data: notifications });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/notifications/:notificationId/read
 * Source: 07-api-spec.md §28 (Mark Notification Read), FR-052.
 */
export async function markNotificationAsReadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const notification = await markNotificationAsRead(
      req.auth.userId,
      req.params.notificationId as string,
    );
    res.json({ data: notification });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/notifications/read-all
 * Source: 07-api-spec.md §28 (Mark All Read).
 */
export async function markAllNotificationsAsReadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await markAllNotificationsAsRead(req.auth.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
