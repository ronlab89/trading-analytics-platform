import type { User as PrismaUser } from "../../generated/client/index.js";
import type { CreateUserInput, User, UserRole } from "@trading/domain";

/**
 * Same rationale as portfolio-mapper.ts's toDomainStatus: Prisma's
 * generated `UserRole` is a real TS enum, the domain's `UserRole` is a
 * const-object union — identical string values, distinct nominal types.
 * This cast is the single, explicit bridge between them.
 */
function toDomainRole(role: PrismaUser["role"]): UserRole {
  return role;
}

export function toDomainUser(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: toDomainRole(row.role),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPrismaCreateInput(input: CreateUserInput) {
  return {
    email: input.email,
    displayName: input.displayName,
    ...(input.role !== undefined ? { role: input.role } : {}),
  };
}
