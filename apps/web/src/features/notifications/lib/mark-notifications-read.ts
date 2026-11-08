import type { NotificationResponse } from "@trading/contracts";

/**
 * The notifications after marking as read: the one with `notificationId`, or every unread one when
 * none is given. A notification already read keeps the moment it was read, and the list that comes
 * back is the same one when nothing changes.
 */
export function markNotificationsRead(
  notifications: readonly NotificationResponse[],
  readAt: string,
  notificationId?: string,
): readonly NotificationResponse[] {
  const next = notifications.map((notification) =>
    notification.readAt === null &&
    (notificationId === undefined || notification.id === notificationId)
      ? { ...notification, readAt }
      : notification,
  );
  return next.every((notification, index) => notification === notifications[index])
    ? notifications
    : next;
}
