import type { CreateCredentialInput, Credential, CredentialRepository } from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainCredential, toPrismaCreateInput } from "../mappers/credential-mapper.js";

export class PrismaCredentialRepository implements CredentialRepository {
  async getByUserId(userId: string): Promise<Credential | null> {
    const row = await prisma.credential.findUnique({ where: { userId } });
    return row ? toDomainCredential(row) : null;
  }

  async create(input: CreateCredentialInput): Promise<Credential> {
    const row = await prisma.credential.create({ data: toPrismaCreateInput(input) });
    return toDomainCredential(row);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<Credential> {
    const row = await prisma.credential.update({
      where: { userId },
      data: { passwordHash },
    });
    return toDomainCredential(row);
  }
}
