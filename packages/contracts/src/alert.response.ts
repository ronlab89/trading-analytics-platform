import { z } from "zod";
import { AlertType } from "@trading/domain";
import type { Alert } from "@trading/domain";
import { isoTimestampSchema, presentTimestamp } from "./response-common.schema.js";

const alertTypeValues = Object.values(AlertType) as [AlertType, ...AlertType[]];

/**
 * Response shape for the alert endpoints.
 * Source: 07-api-spec.md (Alerts), 05-data-model.md §22.
 */
export const alertResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  assetId: z.string().nullable(),
  portfolioId: z.string().nullable(),
  type: z.enum(alertTypeValues),
  condition: z.string(),
  threshold: z.number(),
  enabled: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type AlertResponse = z.infer<typeof alertResponseSchema>;

export function presentAlert(alert: Alert): AlertResponse {
  return {
    id: alert.id,
    userId: alert.userId,
    assetId: alert.assetId,
    portfolioId: alert.portfolioId,
    type: alert.type,
    condition: alert.condition,
    threshold: alert.threshold,
    enabled: alert.enabled,
    createdAt: presentTimestamp(alert.createdAt),
    updatedAt: presentTimestamp(alert.updatedAt),
  };
}
