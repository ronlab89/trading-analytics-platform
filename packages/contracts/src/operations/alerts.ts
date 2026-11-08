import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import { alertResponseSchema } from "../alert.response.js";
import { createAlertRequestSchema, updateAlertRequestSchema } from "../alert.schema.js";
import { notificationResponseSchema } from "../notification.response.js";
import { listNotificationsQuerySchema } from "../notification.schema.js";
import { alertIdParamsSchema, notificationIdParamsSchema } from "../params.schema.js";
import { dataEnvelope } from "../response-common.schema.js";

/** Alerts (07-api-spec.md §27). */
export const alertOperations: readonly ApiOperation[] = [
  {
    operationId: "listAlerts",
    method: "get",
    path: "/api/v1/alerts",
    tag: "Alerts",
    summary: "List the user's alerts",
    authenticated: true,
    success: {
      status: 200,
      description: "The alerts of the user.",
      schema: dataEnvelope(z.array(alertResponseSchema)),
    },
    errors: [401, 403, 429],
  },
  {
    operationId: "getAlert",
    method: "get",
    path: "/api/v1/alerts/:alertId",
    tag: "Alerts",
    summary: "Get an alert",
    authenticated: true,
    params: alertIdParamsSchema,
    success: {
      status: 200,
      description: "The alert.",
      schema: dataEnvelope(alertResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "createAlert",
    method: "post",
    path: "/api/v1/alerts",
    tag: "Alerts",
    summary: "Create an alert",
    description:
      "An alert must reference an asset or a portfolio, and an archived portfolio cannot be used. The server evaluates `PRICE` alerts with the conditions `ABOVE` and `BELOW` on every price tick; the other types are stored but not evaluated yet.",
    authenticated: true,
    body: createAlertRequestSchema,
    success: {
      status: 201,
      description: "The alert that was created.",
      schema: dataEnvelope(alertResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "updateAlert",
    method: "patch",
    path: "/api/v1/alerts/:alertId",
    tag: "Alerts",
    summary: "Update an alert",
    description: "Only the condition, the threshold and `enabled` can change.",
    authenticated: true,
    params: alertIdParamsSchema,
    body: updateAlertRequestSchema,
    success: {
      status: 200,
      description: "The alert after the change.",
      schema: dataEnvelope(alertResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "deleteAlert",
    method: "delete",
    path: "/api/v1/alerts/:alertId",
    tag: "Alerts",
    summary: "Delete an alert",
    authenticated: true,
    params: alertIdParamsSchema,
    success: { status: 204, description: "The alert was deleted." },
    errors: [400, 401, 403, 404, 429],
  },
];

/** Notifications (07-api-spec.md §28). */
export const notificationOperations: readonly ApiOperation[] = [
  {
    operationId: "listNotifications",
    method: "get",
    path: "/api/v1/notifications",
    tag: "Notifications",
    summary: "List the user's notifications",
    description: "Not paginated; `unreadOnly=true` keeps only the unread ones.",
    authenticated: true,
    query: listNotificationsQuerySchema,
    success: {
      status: 200,
      description: "The notifications of the user.",
      schema: dataEnvelope(z.array(notificationResponseSchema)),
    },
    errors: [400, 401, 403, 429],
  },
  {
    operationId: "markAllNotificationsRead",
    method: "post",
    path: "/api/v1/notifications/read-all",
    tag: "Notifications",
    summary: "Mark every notification as read",
    authenticated: true,
    success: { status: 204, description: "Every notification is read." },
    errors: [401, 403, 429],
  },
  {
    operationId: "markNotificationRead",
    method: "post",
    path: "/api/v1/notifications/:notificationId/read",
    tag: "Notifications",
    summary: "Mark a notification as read",
    description: "A notification of another user is indistinguishable from a missing one.",
    authenticated: true,
    params: notificationIdParamsSchema,
    success: {
      status: 200,
      description: "The notification after the change.",
      schema: dataEnvelope(notificationResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
];
