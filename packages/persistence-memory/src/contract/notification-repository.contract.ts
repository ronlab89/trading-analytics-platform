import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotificationSeverity } from "@trading/domain";
import type { CreateNotificationInput, NotificationRepository } from "@trading/domain";

export interface NotificationContractContext {
  readonly repository: NotificationRepository;
  readonly fixtures: {
    /** An existing user that owns the notifications created by the suite. */
    readonly userId: string;
    /** A second existing user, to check notifications are scoped by owner. */
    readonly otherUserId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

const readAt = new Date("2026-01-09T00:00:00.000Z");
const earlierReadAt = new Date("2026-01-02T00:00:00.000Z");

/**
 * Behavior every `NotificationRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Listing is only checked to be newest first by `createdAt`: two notifications
 * created within the same millisecond have no defined order across storages.
 * The tie-break of the in-memory implementation is checked by its own tests.
 */
export function notificationRepositoryContract(
  name: string,
  factory: () => Promise<NotificationContractContext>,
): void {
  describe(`${name} (NotificationRepository contract)`, () => {
    let context: NotificationContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (overrides: Partial<CreateNotificationInput> = {}) => ({
      userId: context.fixtures.userId,
      type: "ALERT_TRIGGERED",
      title: "Alert",
      message: "AAPL crossed 200",
      severity: NotificationSeverity.INFO,
      ...overrides,
    });

    it("creates an unread notification with an id and empty metadata by default", async () => {
      const created = await context.repository.create(input());
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({ ...input(), readAt: null, metadata: {} });
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it("keeps explicit metadata", async () => {
      const metadata = { assetId: "asset-1", threshold: 200 };
      const created = await context.repository.create(input({ metadata }));
      expect(created.metadata).toEqual(metadata);
    });

    it("finds a notification by id and returns null for an unknown id", async () => {
      const created = await context.repository.create(input());
      expect(await context.repository.getById(created.id)).toEqual(created);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
    });

    it("lists only the notifications of the given user", async () => {
      const mine = await context.repository.create(input());
      await context.repository.create(input({ userId: context.fixtures.otherUserId }));
      expect(await context.repository.listByUserId(context.fixtures.userId)).toEqual([mine]);
    });

    it("lists the newest first", async () => {
      const created = [];
      for (let i = 0; i < 3; i++) {
        created.push(await context.repository.create(input()));
      }
      const listed = await context.repository.listByUserId(context.fixtures.userId);
      expect(listed.map((n) => n.id).sort()).toEqual(created.map((n) => n.id).sort());
      const times = listed.map((n) => n.createdAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it("lists only the unread ones when asked", async () => {
      const read = await context.repository.create(input());
      const unread = await context.repository.create(input());
      await context.repository.markAsRead(read.id, readAt);
      const unreadOnly = await context.repository.listByUserId(context.fixtures.userId, {
        unreadOnly: true,
      });
      expect(unreadOnly).toEqual([unread]);
      const all = await context.repository.listByUserId(context.fixtures.userId, {
        unreadOnly: false,
      });
      expect(all).toHaveLength(2);
    });

    it("marks one notification as read and leaves the others alone", async () => {
      const target = await context.repository.create(input());
      const untouched = await context.repository.create(input());
      const marked = await context.repository.markAsRead(target.id, readAt);
      expect(marked).toEqual({ ...target, readAt });
      expect(await context.repository.getById(target.id)).toEqual(marked);
      expect(await context.repository.getById(untouched.id)).toEqual(untouched);
    });

    it("marks all of a user's unread notifications as read and leaves the rest alone", async () => {
      const alreadyRead = await context.repository.create(input());
      await context.repository.markAsRead(alreadyRead.id, earlierReadAt);
      const unread = await context.repository.create(input());
      const other = await context.repository.create(
        input({ userId: context.fixtures.otherUserId }),
      );
      await context.repository.markAllAsRead(context.fixtures.userId, readAt);
      expect((await context.repository.getById(alreadyRead.id))?.readAt).toEqual(earlierReadAt);
      expect((await context.repository.getById(unread.id))?.readAt).toEqual(readAt);
      expect((await context.repository.getById(other.id))?.readAt).toBeNull();
    });

    it("throws when marking a notification that does not exist as read", async () => {
      await expect(context.repository.markAsRead("nonexistent-id", readAt)).rejects.toThrow();
    });

    it("does not fail when a user has nothing to mark as read", async () => {
      await expect(
        context.repository.markAllAsRead(context.fixtures.userId, readAt),
      ).resolves.toBeUndefined();
    });
  });
}
