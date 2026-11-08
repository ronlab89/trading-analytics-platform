import { z } from "zod";

/**
 * Stable error codes of the API error envelope.
 * Source: 07-api-spec.md §6, ADR-002 point 10. `TIMEOUT` is intentionally absent.
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "DEPENDENCY_ERROR",
  "INTERNAL_ERROR",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** One entry of `error.details`: the Zod issue code or a documented domain code. */
export const errorDetailSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});
export type ErrorDetail = z.infer<typeof errorDetailSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.array(errorDetailSchema).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
