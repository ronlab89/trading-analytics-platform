import { z } from "zod";

/**
 * Request-boundary validation for PATCH /api/v1/preferences.
 * Source: 07-api-spec.md §29 (Update Preferences), 05-data-model.md §23.
 *
 * `theme` and `language` are free-form strings in the data model (no
 * closed list of values), so only non-emptiness is validated here.
 * `defaultPortfolioId` is nullable so a client can explicitly clear it;
 * when a string is given, the service verifies it belongs to the caller.
 * `notificationPreferences` is an open record: its concrete shape is
 * deliberately undefined by the data model (§23).
 *
 * At least one field is required, mirroring the portfolio/alert PATCH
 * schemas.
 */
export const updateUserPreferenceRequestSchema = z
  .object({
    theme: z.string().min(1, "Theme cannot be empty.").optional(),
    language: z.string().min(1, "Language cannot be empty.").optional(),
    defaultPortfolioId: z.string().min(1).nullable().optional(),
    reducedMotion: z.boolean().optional(),
    notificationPreferences: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one preference field must be provided.",
  });

export type UpdateUserPreferenceRequestBody = z.infer<typeof updateUserPreferenceRequestSchema>;
