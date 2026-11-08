import type { Alert } from "@trading/domain";
import type { LogFields } from "./logger.js";

/**
 * Stable names of the alert evaluation events (ADR-009 points 5 and 11,
 * ADR-007 point 9). A re-arm is not logged: it is routine state, not an event.
 */
export const ALERT_EVENTS = {
  triggered: "alert.triggered",
  evaluationFailed: "alert.evaluation_failed",
} as const;

/** The correlation field `alertId` with the identifiers that locate the alert. */
export function alertLogFields(
  alert: Pick<Alert, "id" | "userId" | "assetId">,
  extra: LogFields = {},
): LogFields {
  return {
    alertId: alert.id,
    userId: alert.userId,
    assetId: alert.assetId,
    ...extra,
  };
}
