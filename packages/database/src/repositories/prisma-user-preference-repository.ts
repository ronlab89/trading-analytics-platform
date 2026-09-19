import type {
  CreateUserPreferenceInput,
  UserPreference,
  UserPreferenceRepository,
} from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma } from "../client.js";
import { toDomainUserPreference, toPrismaCreateInput } from "../mappers/user-preference-mapper.js";

export class PrismaUserPreferenceRepository implements UserPreferenceRepository {
  async getByUserId(userId: string): Promise<UserPreference | null> {
    const row = await prisma.userPreference.findUnique({ where: { userId } });
    return row ? toDomainUserPreference(row) : null;
  }

  async create(input: CreateUserPreferenceInput): Promise<UserPreference> {
    const row = await prisma.userPreference.create({ data: toPrismaCreateInput(input) });
    return toDomainUserPreference(row);
  }

  async update(
    userId: string,
    input: Partial<
      Pick<
        UserPreference,
        "theme" | "language" | "defaultPortfolioId" | "reducedMotion" | "notificationPreferences"
      >
    >,
  ): Promise<UserPreference> {
    const { notificationPreferences, ...rest } = input;
    const row = await prisma.userPreference.update({
      where: { userId },
      data: {
        ...rest,
        ...(notificationPreferences !== undefined
          ? { notificationPreferences: notificationPreferences as Prisma.InputJsonValue }
          : {}),
      },
    });
    return toDomainUserPreference(row);
  }
}
