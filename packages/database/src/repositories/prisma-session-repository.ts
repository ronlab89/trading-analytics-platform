import type {
  CreateSessionInput,
  RotateSessionInput,
  Session,
  SessionRepository,
} from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainSession, toPrismaCreateInput } from "../mappers/session-mapper.js";

export class PrismaSessionRepository implements SessionRepository {
  async create(input: CreateSessionInput): Promise<Session> {
    const row = await prisma.session.create({ data: toPrismaCreateInput(input) });
    return toDomainSession(row);
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await prisma.session.findUnique({ where: { tokenHash } });
    return row ? toDomainSession(row) : null;
  }

  /**
   * The conditional update is the compare-and-set: Postgres locks the row, so
   * of two concurrent rotations the second one matches nothing. The create
   * runs in the same transaction, so a taken successor hash rolls it back.
   */
  async rotate(input: RotateSessionInput): Promise<Session | null> {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.session.updateMany({
        where: { id: input.sessionId, rotatedAt: null, revokedAt: null },
        data: {
          rotatedAt: input.rotatedAt,
          successorCiphertext: input.successorCiphertext,
        },
      });

      if (claimed.count === 0) {
        return null;
      }

      const row = await tx.session.create({
        data: {
          ...toPrismaCreateInput(input.successor),
          createdAt: input.rotatedAt,
          lastUsedAt: input.rotatedAt,
        },
      });
      return toDomainSession(row);
    });
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt, successorCiphertext: null },
    });
  }

  async clearExpiredSuccessors(familyId: string, rotatedBefore: Date): Promise<void> {
    await prisma.session.updateMany({
      where: { familyId, rotatedAt: { lt: rotatedBefore }, successorCiphertext: { not: null } },
      data: { successorCiphertext: null },
    });
  }
}
