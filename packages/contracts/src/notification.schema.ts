import { z } from "zod";

/**
 * Query-parameter validation for GET /api/v1/notifications.
 * Source: 07-api-spec.md §28 (List Notifications), FR-051.
 *
 * Deliberately narrower than the spec's illustrative `read`/`type`/
 * `page`/`pageSize` parameters: `NotificationRepository.listByUserId`
 * only supports an `unreadOnly` filter today (no `type` filter, no
 * pagination). Exposing parameters the repository cannot actually
 * honor would mean faking a capability rather than validating one
 * (09-security-spec.md §19 spirit — a schema should describe what the
 * system does, not what it might do later). `unreadOnly` maps 1:1 onto
 * the repository's real filter. Type filtering and pagination for
 * notifications are deferred until there is a concrete need (NFR-070).
 */
export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
