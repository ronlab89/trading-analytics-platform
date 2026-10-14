import { describe, expect, it, vi } from "vitest";
import type { WatchlistItem } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createWatchlistService } from "./watchlist-service.js";

const actor: Actor = { userId: "u1", role: "USER" };

function item(assetId: string, userId = "u1"): WatchlistItem {
  return { id: `w-${assetId}`, userId, assetId, createdAt: new Date("2026-01-01T00:00:00Z") };
}

function build(
  options: { stored?: WatchlistItem[]; assetExists?: boolean; permissions?: RolePermissions } = {},
) {
  const { stored = [item("a1")], assetExists = true } = options;

  const create = vi.fn((input: { userId: string; assetId: string }) =>
    Promise.resolve(item(input.assetId, input.userId)),
  );
  const remove = vi.fn((_userId: string, _assetId: string) => Promise.resolve());
  const getAssetById = vi.fn((_actor: Actor, id: string) =>
    assetExists
      ? Promise.resolve({ id } as never)
      : Promise.reject(new NotFoundError("The requested asset could not be found.")),
  );

  const service = createWatchlistService({
    watchlistRepository: {
      listByUserId: (userId: string) => Promise.resolve(stored.filter((i) => i.userId === userId)),
      getByUserAndAsset: (userId: string, assetId: string) =>
        Promise.resolve(stored.find((i) => i.userId === userId && i.assetId === assetId) ?? null),
      create,
      deleteByUserAndAsset: remove,
    },
    assetService: { getAssetById },
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });

  return { service, create, remove, getAssetById };
}

describe("watchlist service", () => {
  it("lists only the actor's watchlist", async () => {
    const { service } = build({ stored: [item("a1"), item("a2", "u2")] });
    const result = await service.listWatchlist(actor);
    expect(result.map((i) => i.assetId)).toEqual(["a1"]);
  });

  it("adds an existing asset for the actor", async () => {
    const { service, create } = build();
    await service.addToWatchlist(actor, "a9");
    expect(create).toHaveBeenCalledWith({ userId: "u1", assetId: "a9" });
  });

  it("does not add an unknown asset and keeps the asset's not-found message", async () => {
    const { service, create } = build({ assetExists: false });
    const error = await service.addToWatchlist(actor, "ghost").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested asset could not be found.");
    expect(create).not.toHaveBeenCalled();
  });

  it("removes an entry the actor has", async () => {
    const { service, remove } = build();
    await service.removeFromWatchlist(actor, "a1");
    expect(remove).toHaveBeenCalledWith("u1", "a1");
  });

  it("raises NotFoundError when removing an entry the actor does not have", async () => {
    const { service, remove } = build({ stored: [item("a1", "u2")] });
    const error = await service.removeFromWatchlist(actor, "a1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
    expect(remove).not.toHaveBeenCalled();
  });

  it("needs watchlist:read to list and watchlist:write to add or remove", async () => {
    const without = (permission: string): RolePermissions => ({
      USER: new Set(PERMISSIONS.filter((p) => p !== permission)),
      ADMIN: new Set(PERMISSIONS),
    });

    const noRead = build({ permissions: without("watchlist:read") }).service;
    await expect(noRead.listWatchlist(actor)).rejects.toBeInstanceOf(ForbiddenError);

    const noWrite = build({ permissions: without("watchlist:write") }).service;
    await expect(noWrite.addToWatchlist(actor, "a1")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(noWrite.removeFromWatchlist(actor, "a1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
