import type { NotificationResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { toAttention } from "./attention-items";

function notification(
  id: string,
  severity: NotificationResponse["severity"],
  createdAt: string,
  readAt: string | null = null,
): NotificationResponse {
  return {
    id,
    userId: "u1",
    type: "TEST",
    title: `Title ${id}`,
    message: `Message ${id}`,
    severity,
    readAt,
    createdAt,
    metadata: {},
  };
}

describe("toAttention", () => {
  it("lists the unread notifications, newest first", () => {
    const { items } = toAttention(
      [
        notification("old", "INFO", "2026-10-01T10:00:00.000Z"),
        notification("new", "INFO", "2026-10-05T10:00:00.000Z"),
        notification("mid", "INFO", "2026-10-03T10:00:00.000Z"),
      ],
      5,
    );

    expect(items.map((i) => i.id)).toEqual(["new", "mid", "old"]);
  });

  it("leaves out the ones already read", () => {
    const { items, unread } = toAttention(
      [
        notification("read", "WARNING", "2026-10-05T10:00:00.000Z", "2026-10-05T11:00:00.000Z"),
        notification("open", "WARNING", "2026-10-04T10:00:00.000Z"),
      ],
      5,
    );

    expect(items.map((i) => i.id)).toEqual(["open"]);
    expect(unread).toBe(1);
  });

  it("keeps only the requested number but counts every unread one", () => {
    const { items, unread } = toAttention(
      [
        notification("a", "INFO", "2026-10-05T10:00:00.000Z"),
        notification("b", "INFO", "2026-10-04T10:00:00.000Z"),
        notification("c", "INFO", "2026-10-03T10:00:00.000Z"),
      ],
      2,
    );

    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(unread).toBe(3);
  });

  it("calls an error or a warning an alert, a success completed and the rest info", () => {
    const { items } = toAttention(
      [
        notification("e", "ERROR", "2026-10-05T10:00:04.000Z"),
        notification("w", "WARNING", "2026-10-05T10:00:03.000Z"),
        notification("s", "SUCCESS", "2026-10-05T10:00:02.000Z"),
        notification("i", "INFO", "2026-10-05T10:00:01.000Z"),
      ],
      5,
    );

    expect(items.map((i) => [i.kind, i.tone])).toEqual([
      ["alert", "error"],
      ["alert", "warning"],
      ["completed", "neutral"],
      ["info", "neutral"],
    ]);
  });
});
