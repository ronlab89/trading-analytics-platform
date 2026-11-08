import { describe, expect, it } from "vitest";
import { InMemoryCredentialRepository } from "./in-memory-credential-repository.js";

function build() {
  let tick = 0;
  return new InMemoryCredentialRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryCredentialRepository", () => {
  it("stores the password hash exactly as received", async () => {
    const created = await build().create({ userId: "u1", passwordHash: "$2a$12$hash" });
    expect(created).toMatchObject({ userId: "u1", passwordHash: "$2a$12$hash" });
    expect(created.updatedAt).toEqual(created.createdAt);
  });

  it("finds the credential of a user and returns null for another one", async () => {
    const repository = build();
    const created = await repository.create({ userId: "u1", passwordHash: "h1" });
    expect(await repository.getByUserId("u1")).toEqual(created);
    expect(await repository.getByUserId("u2")).toBeNull();
  });

  it("rejects a second credential for the same user", async () => {
    const repository = build();
    await repository.create({ userId: "u1", passwordHash: "h1" });
    await expect(repository.create({ userId: "u1", passwordHash: "h2" })).rejects.toThrow();
  });

  it("replaces the password hash, keeps createdAt and moves updatedAt", async () => {
    const repository = build();
    const created = await repository.create({ userId: "u1", passwordHash: "h1" });
    const updated = await repository.updatePasswordHash("u1", "h2");
    expect(updated.passwordHash).toBe("h2");
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(await repository.getByUserId("u1")).toEqual(updated);
  });

  it("throws when replacing the hash of a user without a credential", async () => {
    await expect(build().updatePasswordHash("ghost", "h")).rejects.toThrow();
  });
});
