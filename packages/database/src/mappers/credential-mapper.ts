import type { Credential as PrismaCredential } from "../../generated/client/index.js";
import type { CreateCredentialInput, Credential } from "@trading/domain";

export function toDomainCredential(row: PrismaCredential): Credential {
  return {
    userId: row.userId,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPrismaCreateInput(input: CreateCredentialInput) {
  return {
    userId: input.userId,
    passwordHash: input.passwordHash,
  };
}
