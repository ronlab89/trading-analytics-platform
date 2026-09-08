import type { NotificationSeverity } from "./enums";

/**
 * Notification entity.
 * Source: docs/05-data-model.md §21
 *
 * `type` is intentionally a free-form string: the data model does not
 * close it to a fixed enum (unlike `severity`), and the functional
 * requirements only give illustrative examples (transaction completed,
 * alert triggered, etc.), not an exhaustive list.
 */
export interface Notification {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly readAt: Date | null;
  readonly createdAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type CreateNotificationInput = Pick<
  Notification,
  "userId" | "type" | "title" | "message" | "severity"
> &
  Partial<Pick<Notification, "metadata">>;

export class InvalidNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNotificationError";
  }
}

export function validateNewNotification(input: CreateNotificationInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidNotificationError("A notification must belong to a user.");
  }

  if (!input.type || input.type.trim().length === 0) {
    throw new InvalidNotificationError("Notification type is required.");
  }

  if (!input.title || input.title.trim().length === 0) {
    throw new InvalidNotificationError("Notification title is required.");
  }

  if (!input.message || input.message.trim().length === 0) {
    throw new InvalidNotificationError("Notification message is required.");
  }
}
