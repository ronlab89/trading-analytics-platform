import { z } from "zod";
import { NotificationSeverity } from "@trading/domain";
import type { Notification } from "@trading/domain";
import { isoTimestampSchema, presentTimestamp } from "./response-common.schema.js";

const severityValues = Object.values(NotificationSeverity) as [
  NotificationSeverity,
  ...NotificationSeverity[],
];

/**
 * Response shape for the notification endpoints.
 * Source: 07-api-spec.md §28, 05-data-model.md §21.
 */
export const notificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  severity: z.enum(severityValues),
  readAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
  metadata: z.record(z.string(), z.unknown()),
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

export function presentNotification(notification: Notification): NotificationResponse {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    severity: notification.severity,
    readAt: notification.readAt ? presentTimestamp(notification.readAt) : null,
    createdAt: presentTimestamp(notification.createdAt),
    metadata: { ...notification.metadata },
  };
}
