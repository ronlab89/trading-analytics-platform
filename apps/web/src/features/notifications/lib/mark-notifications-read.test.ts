import type { NotificationResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { markNotificationsRead } from "./mark-notifications-read";

const NOW = "2026-11-05T16:00:00.000Z";
const EARLIER = "2026-11-05T15:00:00.000Z";

function notification(id: string, readAt: string | null = null): NotificationResponse {
  return {
    id,
    userId: "u1",
    type: "TEST",
    title: id,
    message: "Message",
    severity: "INFO",
    readAt,
    createdAt: "2026-11-05T14:00:00.000Z",
    metadata: {},
  };
}

describe("markNotificationsRead", () => {
  it("marks as read the notification it is given, and no other", () => {
    const [first, second] = markNotificationsRead(
      [notification("n1"), notification("n2")],
      NOW,
      "n1",
    );

    expect(first?.readAt).toBe(NOW);
    expect(second?.readAt).toBeNull();
  });

  it("marks every unread notification when none is given", () => {
    const next = markNotificationsRead([notification("n1"), notification("n2")], NOW);

    expect(next.map(({ readAt }) => readAt)).toEqual([NOW, NOW]);
  });

  it("keeps the moment a notification was read", () => {
    const next = markNotificationsRead([notification("n1", EARLIER), notification("n2")], NOW);

    expect(next.map(({ readAt }) => readAt)).toEqual([EARLIER, NOW]);
  });

  it("does not touch the list it was given", () => {
    const list = [notification("n1")];

    markNotificationsRead(list, NOW, "n1");

    expect(list[0]?.readAt).toBeNull();
  });

  it.each([
    ["an unknown id", [notification("n1")], "n9"],
    ["a notification already read", [notification("n1", EARLIER)], "n1"],
    ["everything read", [notification("n1", EARLIER)], undefined],
    ["an empty list", [], undefined],
  ])("returns the same list for %s", (_name, list, id) => {
    expect(markNotificationsRead(list, NOW, id)).toBe(list);
  });
});
