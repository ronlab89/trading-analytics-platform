import type { NextFunction, Request, Response } from "express";
import { presentNotification } from "@trading/contracts";
import type { ListNotificationsQuery } from "@trading/contracts";
import type { NotificationService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

/** Notification HTTP handlers, bound to the notification use cases they call. */
export function makeNotificationsController(notificationService: NotificationService) {
  /**
   * GET /api/v1/notifications
   * Source: 07-api-spec.md §28 (List Notifications), FR-051.
   *
   * Query validated upstream by `validate(listNotificationsQuerySchema, "query")`.
   */
  async function listNotificationsHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { unreadOnly } = req.validated?.query as ListNotificationsQuery;

    try {
      const notifications = await notificationService.listNotifications(actorOf(req), {
        unreadOnly,
      });
      res.json({ data: notifications.map(presentNotification) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications/:notificationId/read
   * Source: 07-api-spec.md §28 (Mark Notification Read), FR-052.
   */
  async function markNotificationAsReadHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const notification = await notificationService.markNotificationAsRead(
        actorOf(req),
        req.params.notificationId as string,
      );
      res.json({ data: presentNotification(notification) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications/read-all
   * Source: 07-api-spec.md §28 (Mark All Read).
   */
  async function markAllNotificationsAsReadHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await notificationService.markAllNotificationsAsRead(actorOf(req));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  return {
    listNotificationsHandler,
    markNotificationAsReadHandler,
    markAllNotificationsAsReadHandler,
  };
}
