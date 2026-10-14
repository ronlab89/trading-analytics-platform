import { describe, expect, it, vi } from "vitest";
import { NotificationSeverity } from "@trading/domain";
import type { Notification } from "@trading/domain";
import type { Actor } from "./actor.js";
import { fixedClock } from "./clock.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { createNotificationService } from "./notification-service.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";

const actor: Actor = { userId: "u1", role: "USER" };
const now = new Date("2026-09-20T12:00:00Z");

function notification(id: string, userId: string): Notification {
  return {
    id,
    userId,
    type: "ALERT",
    title: "Title",
    message: "Message",
    severity: NotificationSeverity.INFO,
    readAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    metadata: {},
  };
}

function build(options: { stored?: Notification[]; permissions?: RolePermissions } = {}) {
  const { stored = [notification("n1", "u1")] } = options;

  const list = vi.fn((_userId: string, _filter?: { unreadOnly?: boolean }) =>
    Promise.resolve(stored),
  );
  const markAsRead = vi.fn((id: string, readAt: Date) =>
    Promise.resolve({ ...notification(id, "u1"), readAt }),
  );
  const markAllAsRead = vi.fn((_userId: string, _readAt: Date) => Promise.resolve());

  const service = createNotificationService({
    notificationRepository: {
      listByUserId: list,
      getById: (id: string) => Promise.resolve(stored.find((n) => n.id === id) ?? null),
      markAsRead,
      markAllAsRead,
    },
    clock: fixedClock(now),
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });

  return { service, list, markAsRead, markAllAsRead };
}

describe("notification service", () => {
  it("lists the actor's notifications and passes the unread filter through", async () => {
    const { service, list } = build();
    const result = await service.listNotifications(actor, { unreadOnly: true });
    expect(result).toHaveLength(1);
    expect(list).toHaveBeenCalledWith("u1", { unreadOnly: true });
  });

  it("marks one notification as read at the clock's now", async () => {
    const { service, markAsRead } = build();
    const result = await service.markNotificationAsRead(actor, "n1");
    expect(markAsRead).toHaveBeenCalledWith("n1", now);
    expect(result.readAt).toEqual(now);
  });

  it("raises NotFoundError for another user's notification and writes nothing", async () => {
    const { service, markAsRead } = build({ stored: [notification("n1", "u2")] });
    const error = await service.markNotificationAsRead(actor, "n1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
    expect(markAsRead).not.toHaveBeenCalled();
  });

  it("raises NotFoundError for an unknown notification", async () => {
    const { service } = build({ stored: [] });
    await expect(service.markNotificationAsRead(actor, "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("marks every notification of the actor as read at the clock's now", async () => {
    const { service, markAllAsRead } = build();
    await service.markAllNotificationsAsRead(actor);
    expect(markAllAsRead).toHaveBeenCalledWith("u1", now);
  });

  it("needs notification:read to list and notification:write to mark as read", async () => {
    const without = (permission: string): RolePermissions => ({
      USER: new Set(PERMISSIONS.filter((p) => p !== permission)),
      ADMIN: new Set(PERMISSIONS),
    });

    const noRead = build({ permissions: without("notification:read") }).service;
    await expect(noRead.listNotifications(actor, {})).rejects.toBeInstanceOf(ForbiddenError);

    const noWrite = build({ permissions: without("notification:write") }).service;
    await expect(noWrite.markNotificationAsRead(actor, "n1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(noWrite.markAllNotificationsAsRead(actor)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
