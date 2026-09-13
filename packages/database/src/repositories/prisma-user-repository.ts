import type { CreateUserInput, User, UserRepository } from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainUser, toPrismaCreateInput } from "../mappers/user-mapper.js";

/**
 * Prisma-backed implementation of `UserRepository`.
 * See prisma-portfolio-repository.ts for the shared rationale.
 */
export class PrismaUserRepository implements UserRepository {
  async list(): Promise<User[]> {
    const rows = await prisma.user.findMany();
    return rows.map(toDomainUser);
  }

  async getById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toDomainUser(row) : null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? toDomainUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await prisma.user.create({ data: toPrismaCreateInput(input) });
    return toDomainUser(row);
  }

  async update(id: string, input: Partial<Pick<User, "displayName" | "role">>): Promise<User> {
    const row = await prisma.user.update({ where: { id }, data: input });
    return toDomainUser(row);
  }
}
