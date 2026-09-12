import type { CreateUserPreferenceInput, UserPreference } from "../entities/user-preference";

/**
 * UserPreference repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * One row per user (userId is the primary key — see schema.prisma), so
 * this contract is deliberately keyed by userId rather than a separate
 * generated id, and there is no `list()` — preferences are always read
 * in the context of a single, already-known user.
 */
export interface UserPreferenceRepository {
  /** Returns null if the user has never saved preferences yet. */
  getByUserId(userId: string): Promise<UserPreference | null>;

  /**
   * Creates the preferences row for a user.
   * Callers are expected to have already run `validateNewUserPreference`
   * (see entities/user-preference.ts) before calling this.
   */
  create(input: CreateUserPreferenceInput): Promise<UserPreference>;

  /**
   * Updates a user's preferences.
   * Source: 07-api-spec.md §29 (PATCH /preferences).
   * Implementations may choose to upsert here (create if absent, update
   * otherwise) since preferences are "created lazily on first write"
   * (see schema.prisma UserPreference comment) rather than at signup.
   */
  update(
    userId: string,
    input: Partial<
      Pick<
        UserPreference,
        "theme" | "language" | "defaultPortfolioId" | "reducedMotion" | "notificationPreferences"
      >
    >,
  ): Promise<UserPreference>;
}
