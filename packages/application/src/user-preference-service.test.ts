import { describe, expect, it, vi } from "vitest";
import type { UserPreference } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createUserPreferenceService } from "./user-preference-service.js";

const actor: Actor = { userId: "u1", role: "TRADER" };

const preference: UserPreference = {
  userId: "u1",
  theme: "dark",
  language: "en",
  defaultPortfolioId: null,
  reducedMotion: false,
  notificationPreferences: {},
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function build(
  options: {
    stored?: UserPreference | null;
    ownedPortfolios?: string[];
    permissions?: RolePermissions;
  } = {},
) {
  const { stored = preference, ownedPortfolios = ["p1"] } = options;

  const update = vi.fn((userId: string, input: Partial<UserPreference>) =>
    Promise.resolve({ ...preference, ...input, userId }),
  );
  const getPortfolioById = vi.fn((_actor: Actor, portfolioId: string) =>
    ownedPortfolios.includes(portfolioId)
      ? Promise.resolve({} as never)
      : Promise.reject(new NotFoundError("The requested resource could not be found.")),
  );
  const getByUserId = vi.fn((_userId: string) => Promise.resolve(stored));

  const service = createUserPreferenceService({
    userPreferenceRepository: { getByUserId, update },
    portfolioService: { getPortfolioById },
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });

  return { service, update, getByUserId, getPortfolioById };
}

describe("user preference service", () => {
  it("returns the actor's saved preferences", async () => {
    const { service, getByUserId } = build();
    expect(await service.getUserPreferences(actor)).toEqual(preference);
    expect(getByUserId).toHaveBeenCalledWith("u1");
  });

  it("returns null, not an error, when the actor never saved preferences", async () => {
    const { service } = build({ stored: null });
    expect(await service.getUserPreferences(actor)).toBeNull();
  });

  it("updates preferences for the actor", async () => {
    const { service, update } = build();
    await service.updateUserPreferences(actor, { theme: "light" });
    expect(update).toHaveBeenCalledWith("u1", { theme: "light" });
  });

  it("checks that a default portfolio belongs to the actor", async () => {
    const { service, update, getPortfolioById } = build();
    await service.updateUserPreferences(actor, { defaultPortfolioId: "p1" });
    expect(getPortfolioById).toHaveBeenCalledWith(actor, "p1");
    expect(update).toHaveBeenCalledWith("u1", { defaultPortfolioId: "p1" });
  });

  it("refuses a default portfolio of someone else and writes nothing", async () => {
    const { service, update } = build({ ownedPortfolios: [] });
    await expect(
      service.updateUserPreferences(actor, { defaultPortfolioId: "p9" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(update).not.toHaveBeenCalled();
  });

  it("clears the default portfolio with null without consulting the portfolio service", async () => {
    const { service, update, getPortfolioById } = build();
    await service.updateUserPreferences(actor, { defaultPortfolioId: null });
    expect(getPortfolioById).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("u1", { defaultPortfolioId: null });
  });

  it("needs preference:read to read and preference:write to update", async () => {
    const without = (permission: string): RolePermissions => ({
      TRADER: new Set(PERMISSIONS.filter((p) => p !== permission)),
      VIEWER: new Set(PERMISSIONS),
      ADMIN: new Set(PERMISSIONS),
    });

    const noRead = build({ permissions: without("preference:read") }).service;
    await expect(noRead.getUserPreferences(actor)).rejects.toBeInstanceOf(ForbiddenError);

    const noWrite = build({ permissions: without("preference:write") }).service;
    await expect(noWrite.updateUserPreferences(actor, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});
