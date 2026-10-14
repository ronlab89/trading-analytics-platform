import type { Notification, NotificationRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import type { Clock } from "./clock.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";

export interface NotificationServiceDependencies {
  notificationRepository: Pick<
    NotificationRepository,
    "listByUserId" | "getById" | "markAsRead" | "markAllAsRead"
  >;
  /** The only source of "now": nothing here calls `new Date()` (ADR-001 point 8). */
  clock: Clock;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Notification use cases.
 * Source: FR-051, FR-052, 07-api-spec.md §28.
 *
 * Notifications are scoped to the actor: every use case works on
 * `actor.userId`, never on a user id from the request.
 */
export function createNotificationService(dependencies: NotificationServiceDependencies) {
  const { notificationRepository, clock, permissions = ROLE_PERMISSIONS } = dependencies;

  /**
   * Lists the actor's notifications, optionally restricted to unread ones
   * (FR-051). See notification.schema.ts for why the `type` and pagination
   * filters from 07-api-spec.md §28 are not supported yet.
   */
  async function listNotifications(
    actor: Actor,
    filter: { unreadOnly?: boolean },
  ): Promise<Notification[]> {
    assertPermission(actor, "notification:read", permissions);

    return notificationRepository.listByUserId(actor.userId, filter);
  }

  /**
   * Marks a single notification as read (FR-052).
   *
   * Ownership is checked first via getById: `markAsRead` itself takes a
   * bare id with no user, so without this check a caller could mark
   * another user's notification as read. A notification of someone else
   * is indistinguishable from a missing one.
   */
  async function markNotificationAsRead(
    actor: Actor,
    notificationId: string,
  ): Promise<Notification> {
    assertPermission(actor, "notification:write", permissions);

    const notification = await notificationRepository.getById(notificationId);

    if (notification?.userId !== actor.userId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    return notificationRepository.markAsRead(notificationId, clock.now());
  }

  /**
   * Marks every unread notification of the actor as read. It never takes
   * a notification id from the caller, so scoping by `actor.userId` is
   * the whole ownership check.
   */
  async function markAllNotificationsAsRead(actor: Actor): Promise<void> {
    assertPermission(actor, "notification:write", permissions);

    await notificationRepository.markAllAsRead(actor.userId, clock.now());
  }

  return { listNotifications, markNotificationAsRead, markAllNotificationsAsRead };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
