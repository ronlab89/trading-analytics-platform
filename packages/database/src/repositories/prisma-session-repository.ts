import type { CreateSessionInput, Session, SessionRepository } from "@trading/domain";
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
}
