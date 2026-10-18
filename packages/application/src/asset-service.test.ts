import { describe, expect, it, vi } from "vitest";
import type { Asset, AssetRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import { createAssetService } from "./asset-service.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";

const actor: Actor = { userId: "u1", role: "TRADER" };

function asset(id: string): Asset {
  return {
    id,
    symbol: id.toUpperCase(),
    name: `Asset ${id}`,
    assetType: "CRYPTO",
    currency: "USD",
    exchange: "MOCK",
    status: "ACTIVE",
    metadata: {},
  };
}

function fakeRepository(assets: Asset[]) {
  const list = vi.fn((_filter: unknown, page: { page: number; pageSize: number }) =>
    Promise.resolve({ items: assets.slice(0, page.pageSize), total: assets.length }),
  );
  const getByIds = vi.fn((ids: readonly string[]) =>
    Promise.resolve(assets.filter((a) => ids.includes(a.id))),
  );
  const repository: Pick<AssetRepository, "list" | "getById" | "getByIds"> = {
    list,
    getById: (id) => Promise.resolve(assets.find((a) => a.id === id) ?? null),
    getByIds,
  };
  return { repository, list, getByIds };
}

describe("asset service", () => {
  it("lists assets through the repository with the given filter and page", async () => {
    const { repository, list } = fakeRepository([asset("a"), asset("b")]);
    const service = createAssetService({ assetRepository: repository });
    const result = await service.listAssets(actor, { search: "A" }, { page: 1, pageSize: 1 });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(list).toHaveBeenCalledWith({ search: "A" }, { page: 1, pageSize: 1 });
  });

  it("returns an asset by id", async () => {
    const { repository } = fakeRepository([asset("a")]);
    const service = createAssetService({ assetRepository: repository });
    expect((await service.getAssetById(actor, "a")).symbol).toBe("A");
  });

  it("throws NotFoundError with the asset message for an unknown id", async () => {
    const { repository } = fakeRepository([asset("a")]);
    const service = createAssetService({ assetRepository: repository });
    const error = await service.getAssetById(actor, "nope").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested asset could not be found.");
  });

  it("looks up several assets by id once, without duplicates, as a map", async () => {
    const { repository, getByIds } = fakeRepository([asset("a"), asset("b")]);
    const service = createAssetService({ assetRepository: repository });
    const byId = await service.getAssetsByIds(actor, ["a", "b", "a", "missing"]);
    expect([...byId.keys()].sort()).toEqual(["a", "b"]);
    expect(getByIds).toHaveBeenCalledWith(["a", "b", "missing"]);
  });

  it("needs asset:read for every use case", async () => {
    const denied: RolePermissions = {
      TRADER: new Set(PERMISSIONS.filter((p) => p !== "asset:read")),
      VIEWER: new Set(PERMISSIONS),
      ADMIN: new Set(PERMISSIONS),
    };
    const { repository, list, getByIds } = fakeRepository([asset("a")]);
    const service = createAssetService({ assetRepository: repository, permissions: denied });
    await expect(service.listAssets(actor, {}, { page: 1, pageSize: 10 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(service.getAssetById(actor, "a")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.getAssetsByIds(actor, ["a"])).rejects.toBeInstanceOf(ForbiddenError);
    expect(list).not.toHaveBeenCalled();
    expect(getByIds).not.toHaveBeenCalled();
  });
});
