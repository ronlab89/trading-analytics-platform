import { z } from "zod";
import type { UserPreference } from "@trading/domain";
import { isoTimestampSchema, presentTimestamp } from "./response-common.schema.js";

/**
 * Response shape for GET and PATCH /api/v1/preferences.
 * Source: 07-api-spec.md §29, 05-data-model.md §23.
 */
export const userPreferenceResponseSchema = z.object({
  userId: z.string(),
  theme: z.string(),
  language: z.string(),
  defaultPortfolioId: z.string().nullable(),
  reducedMotion: z.boolean(),
  notificationPreferences: z.record(z.string(), z.unknown()),
  updatedAt: isoTimestampSchema,
});
export type UserPreferenceResponse = z.infer<typeof userPreferenceResponseSchema>;

export function presentUserPreference(preference: UserPreference): UserPreferenceResponse {
  return {
    userId: preference.userId,
    theme: preference.theme,
    language: preference.language,
    defaultPortfolioId: preference.defaultPortfolioId,
    reducedMotion: preference.reducedMotion,
    notificationPreferences: { ...preference.notificationPreferences },
    updatedAt: presentTimestamp(preference.updatedAt),
  };
}
