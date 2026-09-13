import type {
  UserPreference as PrismaUserPreference,
  Prisma,
} from "../../generated/client/index.js";
import type { CreateUserPreferenceInput, UserPreference } from "@trading/domain";

export function toDomainUserPreference(row: PrismaUserPreference): UserPreference {
  return {
    userId: row.userId,
    theme: row.theme,
    language: row.language,
    defaultPortfolioId: row.defaultPortfolioId,
    reducedMotion: row.reducedMotion,
    notificationPreferences: row.notificationPreferences as Readonly<Record<string, unknown>>,
    updatedAt: row.updatedAt,
  };
}

export function toPrismaCreateInput(input: CreateUserPreferenceInput) {
  return {
    userId: input.userId,
    theme: input.theme,
    language: input.language,
    ...(input.defaultPortfolioId !== undefined
      ? { defaultPortfolioId: input.defaultPortfolioId }
      : {}),
    ...(input.reducedMotion !== undefined ? { reducedMotion: input.reducedMotion } : {}),
    ...(input.notificationPreferences !== undefined
      ? { notificationPreferences: input.notificationPreferences as Prisma.InputJsonValue }
      : {}),
  };
}
