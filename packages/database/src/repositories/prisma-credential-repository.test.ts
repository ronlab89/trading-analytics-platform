import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaCredentialRepository } from "./prisma-credential-repository.js";

describe("PrismaCredentialRepository", () => {
  const repository = new PrismaCredentialRepository();

  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `credential-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Credential Repository Test User",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("returns null before a credential has ever been created", async () => {
    expect(await repository.getByUserId(userId)).toBeNull();
  });

  it("creates a credential with the given password hash", async () => {
    const credential = await repository.create({
      userId,
      passwordHash: "$2a$10$initialhash",
    });

    expect(credential.userId).toBe(userId);
    expect(credential.passwordHash).toBe("$2a$10$initialhash");
  });

  it("retrieves a credential by userId", async () => {
    const found = await repository.getByUserId(userId);
    expect(found?.passwordHash).toBe("$2a$10$initialhash");
  });

  it("replaces the password hash on update", async () => {
    const updated = await repository.updatePasswordHash(userId, "$2a$10$rotatedhash");
    expect(updated.passwordHash).toBe("$2a$10$rotatedhash");

    const found = await repository.getByUserId(userId);
    expect(found?.passwordHash).toBe("$2a$10$rotatedhash");
  });
});
