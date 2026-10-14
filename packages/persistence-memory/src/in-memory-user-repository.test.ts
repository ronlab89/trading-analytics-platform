import { describe, expect, it } from "vitest";
import { UserRole } from "@trading/domain";
import { InMemoryUserRepository } from "./in-memory-user-repository.js";

const ana = { email: "ana@example.com", displayName: "Ana" };

function build() {
  let tick = 0;
  return new InMemoryUserRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryUserRepository", () => {
  it("creates a USER with an id by default", async () => {
    const created = await build().create(ana);
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({ ...ana, role: UserRole.USER });
    expect(created.updatedAt).toEqual(created.createdAt);
  });

  it("keeps an explicit role", async () => {
    const created = await build().create({ ...ana, role: UserRole.ADMIN });
    expect(created.role).toBe(UserRole.ADMIN);
  });

  it("rejects a second user with the same email", async () => {
    const repository = build();
    await repository.create(ana);
    await expect(repository.create({ ...ana, displayName: "Other" })).rejects.toThrow();
  });

  it("finds a user by id and by exact email, and returns null otherwise", async () => {
    const repository = build();
    const created = await repository.create(ana);
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
    expect(await repository.getByEmail("ana@example.com")).toEqual(created);
    expect(await repository.getByEmail("ANA@example.com")).toBeNull();
    expect(await repository.getByEmail("nobody@example.com")).toBeNull();
  });

  it("lists every user in insertion order", async () => {
    const repository = build();
    const first = await repository.create(ana);
    const second = await repository.create({ email: "bo@example.com", displayName: "Bo" });
    expect(await repository.list()).toEqual([first, second]);
  });

  it("updates the display name and role only, and moves updatedAt", async () => {
    const repository = build();
    const created = await repository.create(ana);
    const updated = await repository.update(created.id, {
      displayName: "Ana M.",
      role: UserRole.ADMIN,
    });
    expect(updated).toMatchObject({
      id: created.id,
      email: ana.email,
      displayName: "Ana M.",
      role: UserRole.ADMIN,
    });
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(await repository.getById(created.id)).toEqual(updated);
  });

  it("throws when updating a user that does not exist", async () => {
    await expect(build().update("ghost", { displayName: "x" })).rejects.toThrow();
  });
});
