import type {
  CreateUserPreferenceInput,
  UserPreference,
  UserPreferenceRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

type UserPreferenceUpdate = Partial<
  Pick<
    UserPreference,
    "theme" | "language" | "defaultPortfolioId" | "reducedMotion" | "notificationPreferences"
  >
>;

/** Defaults of the `UserPreference` table, applied when `update` creates the row. */
const SCHEMA_DEFAULTS = { theme: "system", language: "en" } as const;

/**
 * In-memory implementation of `UserPreferenceRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: one row per user (a second `create` throws),
 * optional fields default to null, false and `{}`, and `update` is an upsert:
 * it creates the row with the schema defaults when the user has none and
 * ignores undefined fields.
 */
export class InMemoryUserPreferenceRepository implements UserPreferenceRepository {
  private readonly rows = new Map<string, UserPreference>();
  private readonly now: () => Date;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  getByUserId(userId: string): Promise<UserPreference | null> {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }

  create(input: CreateUserPreferenceInput): Promise<UserPreference> {
    if (this.rows.has(input.userId)) {
      return Promise.reject(new Error(`User ${input.userId} already has preferences.`));
    }

    const preference: UserPreference = {
      userId: input.userId,
      theme: input.theme,
      language: input.language,
      defaultPortfolioId: input.defaultPortfolioId ?? null,
      reducedMotion: input.reducedMotion ?? false,
      notificationPreferences: input.notificationPreferences ?? {},
      updatedAt: this.now(),
    };
    this.rows.set(preference.userId, preference);

    return Promise.resolve(preference);
  }

  update(userId: string, input: UserPreferenceUpdate): Promise<UserPreference> {
    // Prisma ignores undefined fields; the type forbids them, but callers can still pass one.
    const changes = Object.fromEntries(
      Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined),
    ) as UserPreferenceUpdate;

    const base: UserPreference = this.rows.get(userId) ?? {
      userId,
      ...SCHEMA_DEFAULTS,
      defaultPortfolioId: null,
      reducedMotion: false,
      notificationPreferences: {},
      updatedAt: this.now(),
    };
    const preference: UserPreference = { ...base, ...changes, updatedAt: this.now() };
    this.rows.set(userId, preference);

    return Promise.resolve(preference);
  }
}
