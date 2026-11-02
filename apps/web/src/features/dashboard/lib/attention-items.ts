import type { NotificationResponse } from "@trading/contracts";

export type AttentionKind = "alert" | "info" | "completed";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  /** Whether it is a warning or an error, to tint it. */
  tone: "warning" | "error" | "neutral";
  title: string;
  message: string;
  createdAt: string;
}

export interface Attention {
  /** The latest unread notifications, newest first. */
  items: AttentionItem[];
  /** How many notifications are unread in all, which may be more than `items` holds. */
  unread: number;
}

function toItem(notification: NotificationResponse): AttentionItem {
  const { id, severity, title, message, createdAt } = notification;
  switch (severity) {
    case "ERROR":
      return { id, kind: "alert", tone: "error", title, message, createdAt };
    case "WARNING":
      return { id, kind: "alert", tone: "warning", title, message, createdAt };
    case "SUCCESS":
      return { id, kind: "completed", tone: "neutral", title, message, createdAt };
    case "INFO":
      return { id, kind: "info", tone: "neutral", title, message, createdAt };
  }
}

/**
 * What the "Requiere atención" panel shows of the notifications: the unread ones, the newest
 * first, up to `limit`, and how many unread there are in all. A notification already read needs no
 * attention, so it is not listed.
 */
export function toAttention(
  notifications: readonly NotificationResponse[],
  limit: number,
): Attention {
  const unread = notifications
    .filter((notification) => notification.readAt === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items: unread.slice(0, limit).map(toItem), unread: unread.length };
}
