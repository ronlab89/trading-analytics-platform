import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { PrismaUserPreferenceRepository } from "./prisma-user-preference-repository.js";

describe("PrismaUserPreferenceRepository", () => {
  const repository = new PrismaUserPreferenceRepository();

  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `preference-repo-test-${crypto.randomUUID()}@example.com`,
        displayName: "Preference Repository Test User",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("returns null before preferences have ever been created", async () => {
    expect(await repository.getByUserId(userId)).toBeNull();
  });

  it("creates preferences with sensible defaults for optional fields", async () => {
    const preference = await repository.create({ userId, theme: "dark", language: "en" });

    expect(preference.defaultPortfolioId).toBeNull();
    expect(preference.reducedMotion).toBe(false);
    expect(preference.notificationPreferences).toEqual({});
  });

  it("retrieves preferences by userId", async () => {
    const found = await repository.getByUserId(userId);
    expect(found?.userId).toBe(userId);
    expect(found?.theme).toBe("dark");
  });

  it("updates individual preference fields", async () => {
    const updated = await repository.update(userId, {
      theme: "light",
      reducedMotion: true,
      notificationPreferences: { email: false, push: true },
    });

    expect(updated.theme).toBe("light");
    expect(updated.reducedMotion).toBe(true);
    expect(updated.notificationPreferences).toEqual({ email: false, push: true });
    // language must remain untouched by a partial update
    expect(updated.language).toBe("en");
  });
});
