import { z } from "zod";
import { AlertType } from "@trading/domain";
import type { AlertType as AlertTypeValue } from "@trading/domain";

const alertTypeValues = Object.values(AlertType) as [AlertTypeValue, ...AlertTypeValue[]];

/**
 * Request-boundary validation for POST /api/v1/alerts.
 * Source: 07-api-spec.md §27 (Create Alert), 05-data-model.md §22.
 *
 * This validates shape/type only; the domain invariant that an alert
 * must reference at least one of assetId/portfolioId is enforced both
 * here (so the client gets an immediate, field-attributed 400) and
 * again by `validateNewAlert` in the service layer — same
 * both-boundaries-validate pattern as transaction/portfolio schemas
 * (09-security-spec.md §19).
 */
export const createAlertRequestSchema = z
  .object({
    assetId: z.string().min(1).optional(),
    portfolioId: z.string().min(1).optional(),
    type: z.enum(alertTypeValues),
    condition: z.string().min(1, "Alert condition is required."),
    threshold: z.number(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => data.assetId !== undefined || data.portfolioId !== undefined, {
    message: "An alert must reference an asset or a portfolio.",
    path: ["assetId"],
  });

export type CreateAlertRequestBody = z.infer<typeof createAlertRequestSchema>;

/**
 * Request-boundary validation for PATCH /api/v1/alerts/:alertId.
 * Source: 07-api-spec.md §27 (Update Alert).
 *
 * Matches `AlertRepository.update`'s editable field set: `condition`,
 * `threshold`, `enabled`. `assetId`/`portfolioId`/`type` are not
 * editable after creation — changing what an alert monitors is
 * conceptually a new alert, not an update to an existing one.
 */
export const updateAlertRequestSchema = z
  .object({
    condition: z.string().min(1, "Alert condition is required.").optional(),
    threshold: z.number().optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.condition !== undefined || data.threshold !== undefined || data.enabled !== undefined,
    { message: "At least one field (condition, threshold or enabled) must be provided." },
  );

export type UpdateAlertRequestBody = z.infer<typeof updateAlertRequestSchema>;
