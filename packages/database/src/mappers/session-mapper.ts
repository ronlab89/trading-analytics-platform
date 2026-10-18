import type { Session as PrismaSession } from "../../generated/client/index.js";
import type { CreateSessionInput, Session } from "@trading/domain";

export function toDomainSession(row: PrismaSession): Session {
  return {
    id: row.id,
    userId: row.userId,
    familyId: row.familyId,
    tokenHash: row.tokenHash,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    rotatedAt: row.rotatedAt,
    revokedAt: row.revokedAt,
  };
}

export function toPrismaCreateInput(input: CreateSessionInput) {
  return {
    userId: input.userId,
    familyId: input.familyId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
  };
}
