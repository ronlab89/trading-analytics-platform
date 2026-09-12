import type { CreateNotificationInput, Notification } from "../entities/notification";

/**
 * Notification repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 */
export interface NotificationRepository {
  /**
   * Source: FR-051 (Display Notifications).
   * `unreadOnly` supports the common "badge count" / inbox-style read
   * path without forcing every caller to filter client-side.
   */
  listByUserId(userId: string, filter?: { unreadOnly?: boolean }): Promise<Notification[]>;

  /**
   * Creates a new notification.
   * Callers are expected to have already run `validateNewNotification`
   * (see entities/notification.ts) before calling this.
   */
  create(input: CreateNotificationInput): Promise<Notification>;

  /** Source: FR-052 (Notification Lifecycle — mark as read). */
  markAsRead(id: string, readAt: Date): Promise<Notification>;

  /** Source: 07-api-spec.md §28 (POST /notifications/read-all). */
  markAllAsRead(userId: string, readAt: Date): Promise<void>;
}
