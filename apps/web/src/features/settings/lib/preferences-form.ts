import type { UpdateUserPreferenceRequestBody, UserPreferenceResponse } from "@trading/contracts";
import { LANGUAGES } from "@trading/contracts";
import type { Language } from "@/i18n/resources";

/** What the form edits; the rest of the saved record (theme, notifications) it never touches. */
export interface PreferencesDraft {
  language: Language;
  defaultPortfolioId: string | null;
  reducedMotion: boolean;
}

const isLanguage = (value: string): value is Language =>
  (LANGUAGES as readonly string[]).includes(value);

/**
 * The draft the form starts from: the saved preferences, or, while nothing was saved, the
 * language in use, no default portfolio and the motion the system asks for.
 */
export function initialDraft(
  saved: UserPreferenceResponse | null | undefined,
  languageInUse: Language,
): PreferencesDraft {
  return {
    language:
      saved !== null && saved !== undefined && isLanguage(saved.language)
        ? saved.language
        : languageInUse,
    defaultPortfolioId: saved?.defaultPortfolioId ?? null,
    reducedMotion: saved?.reducedMotion ?? false,
  };
}

/** Only the fields the user changed, which is what the PATCH takes; empty when nothing changed. */
export function changesOf(
  initial: PreferencesDraft,
  draft: PreferencesDraft,
): UpdateUserPreferenceRequestBody {
  const changes: UpdateUserPreferenceRequestBody = {};
  if (draft.language !== initial.language) changes.language = draft.language;
  if (draft.defaultPortfolioId !== initial.defaultPortfolioId) {
    changes.defaultPortfolioId = draft.defaultPortfolioId;
  }
  if (draft.reducedMotion !== initial.reducedMotion) changes.reducedMotion = draft.reducedMotion;
  return changes;
}
