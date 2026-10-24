import { z } from "zod";
import { isoTimestampSchema } from "./response-common.schema.js";

/**
 * Bodies of the unauthenticated service endpoints, which do not use the
 * `{ data }` envelope. Source: 07-api-spec.md §30, 13-observability-spec.md §23.
 */

/** GET /: the service answers. */
export const serviceInfoResponseSchema = z.object({
  service: z.string(),
  status: z.literal("ok"),
});
export type ServiceInfoResponse = z.infer<typeof serviceInfoResponseSchema>;

/** GET /health: the process is running; no dependency is checked. */
export const livenessResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: isoTimestampSchema,
});
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;

/**
 * GET /health/ready: `ok` with the database check, or `unavailable` with a 503.
 * While the process shuts down it answers 503 with no `checks` at all.
 */
export const readinessResponseSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
  service: z.string(),
  timestamp: isoTimestampSchema,
  checks: z.object({ database: z.enum(["ok", "unavailable"]) }).optional(),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
