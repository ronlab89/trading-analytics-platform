import { describe, expect, it } from "vitest";
import type { UserPreference } from "@trading/domain";
import { presentUserPreference, userPreferenceResponseSchema } from "./user-preference.response.js";

const entity: UserPreference = {
  userId: "u1",
  theme: "dark",
  language: "es",
  defaultPortfolioId: null,
  reducedMotion: true,
  notificationPreferences: { email: false },
  updatedAt: new Date("2026-10-13T12:00:00.000Z"),
};

describe("user preference presenter", () => {
  it("serializes exactly the fields the API returned before, ISO date included", () => {
    const dto = presentUserPreference(entity);
    expect(dto).toEqual(JSON.parse(JSON.stringify(entity)));
    expect(userPreferenceResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields that are not in the contract", () => {
    const dto = presentUserPreference({ ...entity, extra: "secret" } as UserPreference);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "defaultPortfolioId",
        "language",
        "notificationPreferences",
        "reducedMotion",
        "theme",
        "updatedAt",
        "userId",
      ].sort(),
    );
  });
});
