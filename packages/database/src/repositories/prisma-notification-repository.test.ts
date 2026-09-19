import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaNotificationRepository } from "./prisma-notification-repository.js";

describe("PrismaNotificationRepository", () => {
  const repository = new PrismaNotificationRepository();

  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `notification-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Notification Repository Test User",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("creates a notification with metadata coalesced to {} when omitted", async () => {
    const notification = await repository.create({
      userId,
      type: "transaction.completed",
      title: "Transaction completed",
      message: "Your BUY order was executed.",
      severity: "SUCCESS",
    });

    expect(notification.metadata).toEqual({});
    expect(notification.readAt).toBeNull();
  });

  it("creates a notification with explicit metadata", async () => {
    const notification = await repository.create({
      userId,
      type: "alert.triggered",
      title: "Alert triggered",
      message: "BTC crossed your price threshold.",
      severity: "WARNING",
      metadata: { assetId: "asset_001", threshold: 200 },
    });

    expect(notification.metadata).toEqual({ assetId: "asset_001", threshold: 200 });
  });

  it("lists notifications filtered by unreadOnly", async () => {
    const unread = await repository.create({
      userId,
      type: "test.unread",
      title: "Unread",
      message: "Still unread.",
      severity: "INFO",
    });
    const read = await repository.create({
      userId,
      type: "test.read",
      title: "Read",
      message: "Already read.",
      severity: "INFO",
    });
    await repository.markAsRead(read.id, new Date());

    const unreadOnly = await repository.listByUserId(userId, { unreadOnly: true });
    expect(unreadOnly.some((n) => n.id === unread.id)).toBe(true);
    expect(unreadOnly.some((n) => n.id === read.id)).toBe(false);
  });

  it("marks a single notification as read", async () => {
    const created = await repository.create({
      userId,
      type: "test.mark",
      title: "To mark",
      message: "Mark me as read.",
      severity: "INFO",
    });

    const readAt = new Date();
    const marked = await repository.markAsRead(created.id, readAt);
    expect(marked.readAt?.toISOString()).toBe(readAt.toISOString());
  });

  it("marks all unread notifications for a user as read", async () => {
    await repository.create({
      userId,
      type: "test.bulk1",
      title: "Bulk 1",
      message: "First.",
      severity: "INFO",
    });
    await repository.create({
      userId,
      type: "test.bulk2",
      title: "Bulk 2",
      message: "Second.",
      severity: "INFO",
    });

    await repository.markAllAsRead(userId, new Date());

    const remainingUnread = await repository.listByUserId(userId, { unreadOnly: true });
    expect(remainingUnread).toHaveLength(0);
  });
});
