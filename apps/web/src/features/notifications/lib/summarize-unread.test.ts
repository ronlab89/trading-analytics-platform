import type { NotificationResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { summarizeUnread } from "./summarize-unread";

function notification(
  id: string,
  severity: NotificationResponse["severity"],
  readAt: string | null = null,
): NotificationResponse {
  return {
    id,
    userId: "u1",
    type: "TEST",
    title: id,
    message: "Message",
    severity,
    readAt,
    createdAt: "2026-11-05T14:00:00.000Z",
    metadata: {},
  };
}

describe("summarizeUnread", () => {
  it("counts every unread notification", () => {
    const summary = summarizeUnread([
      notification("n1", "INFO"),
      notification("n2", "SUCCESS"),
      notification("n3", "WARNING"),
    ]);

    expect(summary.unread).toBe(3);
  });

  it("counts as alerts the unread ones that warn or fail, and no other", () => {
    const summary = summarizeUnread([
      notification("n1", "INFO"),
      notification("n2", "SUCCESS"),
      notification("n3", "WARNING"),
      notification("n4", "ERROR"),
    ]);

    expect(summary.alerts).toBe(2);
  });

  it("leaves out what was read, in both counts", () => {
    const summary = summarizeUnread([
      notification("n1", "WARNING", "2026-11-05T15:00:00.000Z"),
      notification("n2", "ERROR", "2026-11-05T15:00:00.000Z"),
      notification("n3", "INFO"),
    ]);

    expect(summary).toEqual({ unread: 1, alerts: 0 });
  });

  it("is zero for no notifications", () => {
    expect(summarizeUnread([])).toEqual({ unread: 0, alerts: 0 });
  });
});
