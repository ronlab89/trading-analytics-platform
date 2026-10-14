import type { UserPreference, UserPreferenceRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

export interface UpdateUserPreferencesRequest {
  theme?: string;
  language?: string;
  defaultPortfolioId?: string | null;
  reducedMotion?: boolean;
  notificationPreferences?: Readonly<Record<string, unknown>>;
}

export interface UserPreferenceServiceDependencies {
  userPreferenceRepository: Pick<UserPreferenceRepository, "getByUserId" | "update">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * User preference use cases.
 * Source: 07-api-spec.md §29, 05-data-model.md §23.
 *
 * Preferences are keyed by userId (one row per user), so they are inherently
 * scoped to the actor: there is no caller-supplied resource id to check
 * ownership against.
 */
export function createUserPreferenceService(dependencies: UserPreferenceServiceDependencies) {
  const {
    userPreferenceRepository,
    portfolioService,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /**
   * Returns the actor's saved preferences, or null if they never saved any.
   *
   * Preferences are created lazily on first write, so "no row yet" is a
   * valid state, not an error: a GET must not return 404 for it, nor persist
   * a row. Callers treat null as "use application defaults".
   */
  async function getUserPreferences(actor: Actor): Promise<UserPreference | null> {
    assertPermission(actor, "preference:read", permissions);

    return userPreferenceRepository.getByUserId(actor.userId);
  }

  /**
   * Updates (or lazily creates) the actor's preferences.
   *
   * A provided `defaultPortfolioId` must belong to the actor (the portfolio
   * service raises its own 404-on-mismatch). Passing null clears the default
   * and needs no check. The repository's `update` is an atomic upsert.
   */
  async function updateUserPreferences(
    actor: Actor,
    input: UpdateUserPreferencesRequest,
  ): Promise<UserPreference> {
    assertPermission(actor, "preference:write", permissions);

    if (typeof input.defaultPortfolioId === "string") {
      await portfolioService.getPortfolioById(actor, input.defaultPortfolioId);
    }

    return userPreferenceRepository.update(actor.userId, input);
  }

  return { getUserPreferences, updateUserPreferences };
}

export type UserPreferenceService = ReturnType<typeof createUserPreferenceService>;
