import type { NotificationResponse } from "@trading/contracts";

export interface UnreadSummary {
  /** Every notification not read yet: what the bell counts. */
  unread: number;
  /** The unread ones that warn or fail: what the status bar calls alerts. */
  alerts: number;
}

/** What the shell shows of the notifications: how many are unread, and how many of those are alerts. */
export function summarizeUnread(notifications: readonly NotificationResponse[]): UnreadSummary {
  const unread = notifications.filter(({ readAt }) => readAt === null);
  return {
    unread: unread.length,
    alerts: unread.filter(({ severity }) => severity === "WARNING" || severity === "ERROR").length,
  };
}
