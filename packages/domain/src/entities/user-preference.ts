/**
 * UserPreference entity.
 * Source: docs/05-data-model.md §23
 *
 * `theme` and `language` are free-form strings: the data model does not
 * enumerate their possible values. `notificationPreferences` is left as
 * an open record — its concrete shape is not defined by the data model
 * and is deferred to implementation.
 *
 * §23 — "Preferences must not contain business-critical state."
 */
export interface UserPreference {
  readonly userId: string;
  readonly theme: string;
  readonly language: string;
  readonly defaultPortfolioId: string | null;
  readonly reducedMotion: boolean;
  readonly notificationPreferences: Readonly<Record<string, unknown>>;
  readonly updatedAt: Date;
}

export type CreateUserPreferenceInput = Pick<UserPreference, "userId" | "theme" | "language"> &
  Partial<Pick<UserPreference, "defaultPortfolioId" | "reducedMotion" | "notificationPreferences">>;

export class InvalidUserPreferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserPreferenceError";
  }
}

export function validateNewUserPreference(input: CreateUserPreferenceInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidUserPreferenceError("Preferences must belong to a user.");
  }

  if (!input.theme || input.theme.trim().length === 0) {
    throw new InvalidUserPreferenceError("Theme is required.");
  }

  if (!input.language || input.language.trim().length === 0) {
    throw new InvalidUserPreferenceError("Language is required.");
  }
}
