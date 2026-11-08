import { describe, expect, it } from "vitest";
import { NotificationSeverity } from "@trading/domain";
import { InMemoryNotificationRepository } from "./in-memory-notification-repository.js";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function input(userId = "u1") {
  return {
    userId,
    type: "ALERT_TRIGGERED",
    title: "Alert",
    message: "AAPL crossed 200",
    severity: NotificationSeverity.INFO,
  };
}

function build() {
  let tick = 0;
  return new InMemoryNotificationRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryNotificationRepository", () => {
  it("creates an unread notification with an id and empty metadata by default", async () => {
    const created = await build().create(input());
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({ ...input(), readAt: null, metadata: {} });
  });

  it("keeps explicit metadata", async () => {
    const created = await build().create({ ...input(), metadata: { assetId: "a1" } });
    expect(created.metadata).toEqual({ assetId: "a1" });
  });

  it("finds a notification by id and returns null for an unknown id", async () => {
    const repository = build();
    const created = await repository.create(input());
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
  });

  it("lists one user's notifications, newest first", async () => {
    const repository = build();
    const first = await repository.create(input());
    const second = await repository.create(input());
    await repository.create(input("u2"));
    expect(await repository.listByUserId("u1")).toEqual([second, first]);
    expect(await repository.listByUserId("nobody")).toEqual([]);
  });

  it("orders notifications created at the same instant newest first, even past nine", async () => {
    const repository = new InMemoryNotificationRepository({ now: () => day(1) });
    const created = [];
    for (let i = 0; i < 11; i++) {
      created.push(await repository.create(input()));
    }
    const listed = await repository.listByUserId("u1");
    expect(listed.map((n) => n.id)).toEqual(created.map((n) => n.id).reverse());
  });

  it("lists only the unread ones when asked", async () => {
    const repository = build();
    const read = await repository.create(input());
    const unread = await repository.create(input());
    await repository.markAsRead(read.id, day(5));
    expect(await repository.listByUserId("u1", { unreadOnly: true })).toEqual([unread]);
    expect(await repository.listByUserId("u1", { unreadOnly: false })).toHaveLength(2);
  });

  it("marks one notification as read", async () => {
    const repository = build();
    const created = await repository.create(input());
    const read = await repository.markAsRead(created.id, day(5));
    expect(read).toEqual({ ...created, readAt: day(5) });
    expect(await repository.getById(created.id)).toEqual(read);
  });

  it("marks all of a user's unread notifications as read and leaves the rest alone", async () => {
    const repository = build();
    const alreadyRead = await repository.create(input());
    await repository.markAsRead(alreadyRead.id, day(2));
    const unread = await repository.create(input());
    const other = await repository.create(input("u2"));
    await repository.markAllAsRead("u1", day(9));
    expect((await repository.getById(alreadyRead.id))?.readAt).toEqual(day(2));
    expect((await repository.getById(unread.id))?.readAt).toEqual(day(9));
    expect((await repository.getById(other.id))?.readAt).toBeNull();
  });

  it("does not fail when a user has nothing to mark as read", async () => {
    await expect(build().markAllAsRead("nobody", day(1))).resolves.toBeUndefined();
  });

  it("throws when marking a notification that does not exist", async () => {
    await expect(build().markAsRead("ghost", day(1))).rejects.toThrow();
  });
});
