import { describe, expect, it } from "vitest";
import { InMemoryUserPreferenceRepository } from "./in-memory-user-preference-repository.js";

function build() {
  let tick = 0;
  return new InMemoryUserPreferenceRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryUserPreferenceRepository", () => {
  it("returns null for a user who never saved preferences", async () => {
    expect(await build().getByUserId("u1")).toBeNull();
  });

  it("creates preferences with the schema defaults for the optional fields", async () => {
    const created = await build().create({ userId: "u1", theme: "dark", language: "es" });
    expect(created).toMatchObject({
      userId: "u1",
      theme: "dark",
      language: "es",
      defaultPortfolioId: null,
      reducedMotion: false,
      notificationPreferences: {},
    });
  });

  it("keeps explicit optional fields", async () => {
    const created = await build().create({
      userId: "u1",
      theme: "dark",
      language: "en",
      defaultPortfolioId: "p1",
      reducedMotion: true,
      notificationPreferences: { email: false },
    });
    expect(created).toMatchObject({
      defaultPortfolioId: "p1",
      reducedMotion: true,
      notificationPreferences: { email: false },
    });
  });

  it("rejects a second row for the same user", async () => {
    const repository = build();
    await repository.create({ userId: "u1", theme: "dark", language: "en" });
    await expect(
      repository.create({ userId: "u1", theme: "light", language: "en" }),
    ).rejects.toThrow();
  });

  it("finds the preferences of the given user only", async () => {
    const repository = build();
    const created = await repository.create({ userId: "u1", theme: "dark", language: "en" });
    expect(await repository.getByUserId("u1")).toEqual(created);
    expect(await repository.getByUserId("u2")).toBeNull();
  });

  it("updates only the given fields of existing preferences and moves updatedAt", async () => {
    const repository = build();
    const created = await repository.create({ userId: "u1", theme: "dark", language: "en" });
    const updated = await repository.update("u1", { theme: "light" });
    expect(updated).toMatchObject({ userId: "u1", theme: "light", language: "en" });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(await repository.getByUserId("u1")).toEqual(updated);
  });

  it("clears the default portfolio with null", async () => {
    const repository = build();
    await repository.create({
      userId: "u1",
      theme: "dark",
      language: "en",
      defaultPortfolioId: "p1",
    });
    const updated = await repository.update("u1", { defaultPortfolioId: null });
    expect(updated.defaultPortfolioId).toBeNull();
  });

  it("creates the row on the first update, with the schema defaults (upsert)", async () => {
    const repository = build();
    const created = await repository.update("u1", { reducedMotion: true });
    expect(created).toMatchObject({
      userId: "u1",
      theme: "system",
      language: "en",
      defaultPortfolioId: null,
      reducedMotion: true,
      notificationPreferences: {},
    });
    expect(await repository.getByUserId("u1")).toEqual(created);
  });
});
