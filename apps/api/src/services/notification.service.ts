import { PrismaNotificationRepository } from "@trading/database";
import type { Notification } from "@trading/domain";
import { AppError } from "../errors/app-error.js";

const notificationRepository = new PrismaNotificationRepository();

/**
 * Lists a user's notifications, optionally restricted to unread ones.
 * Source: FR-051 (Display Notifications).
 *
 * See notification.schema.ts for why `type`/pagination filters from
 * 07-api-spec.md §28 are not supported yet.
 */
export function listNotifications(
  userId: string,
  filter: { unreadOnly?: boolean },
): Promise<Notification[]> {
  return notificationRepository.listByUserId(userId, filter);
}

/**
 * Marks a single notification as read.
 * Source: FR-052 (Notification Lifecycle), 07-api-spec.md §28.
 *
 * Ownership is checked first via getById: `markAsRead` itself takes a
 * bare id with no userId, so without this check a caller could mark
 * another user's notification as read. Same 404-on-mismatch pattern
 * used across the API.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  const notification = await notificationRepository.getById(notificationId);

  if (notification?.userId !== userId) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  return notificationRepository.markAsRead(notificationId, new Date());
}

/**
 * Marks every unread notification for a user as read.
 * Source: 07-api-spec.md §28 (Mark All Read).
 *
 * No ownership check needed beyond scoping by userId directly — unlike
 * markNotificationAsRead, this operation never takes a caller-supplied
 * notification id.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await notificationRepository.markAllAsRead(userId, new Date());
}
