import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaUserRepository } from "./prisma-user-repository.js";

/**
 * Integration test for `PrismaUserRepository`.
 * See prisma-portfolio-repository.test.ts for the shared preconditions
 * (Docker Postgres up and migrated).
 *
 * Each test creates its own user with a unique email rather than
 * sharing one across the suite (no beforeAll fixture) — this repository
 * has no cascading child data to worry about, and per-test users avoid
 * any risk of unique-email collisions across test runs.
 */
describe("PrismaUserRepository", () => {
  const repository = new PrismaUserRepository();
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  function uniqueEmail(): string {
    return `user-repo-test-${crypto.randomUUID()}@example.com`;
  }

  it("creates a user with the default role when none is provided", async () => {
    const user = await repository.create({
      email: uniqueEmail(),
      displayName: "Test User",
    });
    createdUserIds.push(user.id);

    expect(user.id).toBeTruthy();
    expect(user.role).toBe("USER");
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("creates a user with an explicit role", async () => {
    const user = await repository.create({
      email: uniqueEmail(),
      displayName: "Admin User",
      role: "ADMIN",
    });
    createdUserIds.push(user.id);

    expect(user.role).toBe("ADMIN");
  });

  it("retrieves a user by id", async () => {
    const created = await repository.create({ email: uniqueEmail(), displayName: "Findable" });
    createdUserIds.push(created.id);

    const found = await repository.getById(created.id);
    expect(found?.id).toBe(created.id);
  });

  it("retrieves a user by email", async () => {
    const email = uniqueEmail();
    const created = await repository.create({ email, displayName: "By Email" });
    createdUserIds.push(created.id);

    const found = await repository.getByEmail(email);
    expect(found?.id).toBe(created.id);
  });

  it("returns null when a user does not exist", async () => {
    expect(await repository.getById("nonexistent-id")).toBeNull();
    expect(await repository.getByEmail("nobody@example.com")).toBeNull();
  });

  it("lists all users including the ones created in this suite", async () => {
    const created = await repository.create({ email: uniqueEmail(), displayName: "Listed" });
    createdUserIds.push(created.id);

    const users = await repository.list();
    expect(users.some((u) => u.id === created.id)).toBe(true);
  });

  it("updates mutable fields", async () => {
    const created = await repository.create({ email: uniqueEmail(), displayName: "Old Name" });
    createdUserIds.push(created.id);

    const updated = await repository.update(created.id, {
      displayName: "New Name",
      role: "ADMIN",
    });

    expect(updated.displayName).toBe("New Name");
    expect(updated.role).toBe("ADMIN");
  });
});
