import { PrismaUserPreferenceRepository } from "@trading/database";
import type { UserPreference } from "@trading/domain";
import { getPortfolioById } from "./portfolio.service.js";

const userPreferenceRepository = new PrismaUserPreferenceRepository();

/**
 * Returns the caller's saved preferences, or null if they have never
 * saved any.
 * Source: 07-api-spec.md §29 (Get Preferences), 05-data-model.md §23.
 *
 * Preferences are created lazily on first write (see schema.prisma), so
 * "no row yet" is a valid state, not an error — a GET must not return
 * 404 for it, nor silently persist a row (a read should have no side
 * effects). Callers treat null as "use application defaults". Same
 * "absence is data, not failure" principle as the null dailyChange in
 * the portfolio overview.
 *
 * Preferences are keyed by userId (one row per user), so they are
 * inherently scoped to the caller: there is no caller-supplied resource
 * id to check ownership against.
 */
export function getUserPreferences(userId: string): Promise<UserPreference | null> {
  return userPreferenceRepository.getByUserId(userId);
}

export interface UpdateUserPreferencesRequest {
  theme?: string;
  language?: string;
  defaultPortfolioId?: string | null;
  reducedMotion?: boolean;
  notificationPreferences?: Readonly<Record<string, unknown>>;
}

/**
 * Updates (or lazily creates) the caller's preferences.
 * Source: 07-api-spec.md §29 (Update Preferences).
 *
 * If a `defaultPortfolioId` is provided, it must belong to the caller —
 * reuses getPortfolioById's own 404-on-mismatch so a user cannot point
 * their default at another user's portfolio (nor learn it exists).
 * Passing null explicitly clears the default and needs no check.
 *
 * The repository's `update` is an atomic upsert, so a first-ever PATCH
 * works without a prior create call.
 */
export async function updateUserPreferences(
  userId: string,
  input: UpdateUserPreferencesRequest,
): Promise<UserPreference> {
  if (typeof input.defaultPortfolioId === "string") {
    await getPortfolioById(userId, input.defaultPortfolioId);
  }

  return userPreferenceRepository.update(userId, input);
}
