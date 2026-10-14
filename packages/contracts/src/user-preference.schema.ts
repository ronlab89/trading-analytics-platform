import { z } from "zod";

export const THEMES = ["light", "dark", "system"] as const;
export const LANGUAGES = ["en", "es"] as const;

/**
 * Request-boundary validation for PATCH /api/v1/preferences.
 * Source: 07-api-spec.md §29 (Update Preferences), 05-data-model.md §23.
 *
 * `theme` is `light`, `dark` or `system` and `language` is `en` or `es`
 * (ADR-002 point 10, ADR-010 point 8). The columns stay free-form strings
 * in the data model, so the closed lists live at this boundary only.
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
    theme: z.enum(THEMES, { error: "Theme must be one of: light, dark, system." }).optional(),
    language: z.enum(LANGUAGES, { error: "Language must be one of: en, es." }).optional(),
    defaultPortfolioId: z.string().min(1).nullable().optional(),
    reducedMotion: z.boolean().optional(),
    notificationPreferences: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one preference field must be provided.",
  });

export type UpdateUserPreferenceRequestBody = z.infer<typeof updateUserPreferenceRequestSchema>;
