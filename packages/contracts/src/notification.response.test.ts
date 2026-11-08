import { describe, expect, it } from "vitest";
import type { Notification } from "@trading/domain";
import { notificationResponseSchema, presentNotification } from "./notification.response.js";

const entity: Notification = {
  id: "n1",
  userId: "u1",
  type: "alert.triggered",
  title: "Title",
  message: "Message",
  severity: "WARNING",
  readAt: null,
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
  metadata: { alertId: "a1" },
};

describe("notification presenter", () => {
  it("serializes exactly what the API returned before", () => {
    const dto = presentNotification(entity);
    expect(dto).toEqual(JSON.parse(JSON.stringify(entity)));
    expect(notificationResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("presents readAt as an ISO string once read", () => {
    const read = { ...entity, readAt: new Date("2026-10-14T08:30:00.000Z") };
    expect(presentNotification(read).readAt).toBe("2026-10-14T08:30:00.000Z");
    expect(notificationResponseSchema.safeParse(presentNotification(read)).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const dto = presentNotification({ ...entity, extra: 1 } as Notification);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "createdAt",
        "id",
        "message",
        "metadata",
        "readAt",
        "severity",
        "title",
        "type",
        "userId",
      ].sort(),
    );
  });
});
