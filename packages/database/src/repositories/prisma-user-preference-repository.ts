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

  /**
   * Upsert: preferences are created lazily on first write (see the
   * UserPreference comment in schema.prisma), so a user's first PATCH
   * must succeed even though no row exists yet. Fields omitted on the
   * create path fall back to the column defaults declared in the schema
   * (single source of truth for defaults), and the operation is atomic —
   * no read-then-create race between concurrent first writes.
   */
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
    const data = {
      ...rest,
      ...(notificationPreferences !== undefined
        ? { notificationPreferences: notificationPreferences as Prisma.InputJsonValue }
        : {}),
    };
    const row = await prisma.userPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return toDomainUserPreference(row);
  }
}
