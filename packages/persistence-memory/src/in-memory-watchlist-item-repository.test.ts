import { describe, expect, it } from "vitest";
import { InvalidWatchlistItemError } from "@trading/domain";
import { InMemoryWatchlistItemRepository } from "./in-memory-watchlist-item-repository.js";

function build() {
  return new InMemoryWatchlistItemRepository({ now: () => new Date("2026-01-01T00:00:00Z") });
}

describe("InMemoryWatchlistItemRepository", () => {
  it("adds an asset with an id and createdAt from now", async () => {
    const created = await build().create({ userId: "u1", assetId: "a1" });
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({
      userId: "u1",
      assetId: "a1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
  });

  it("rejects the same asset twice for the same user, but not for another user", async () => {
    const repository = build();
    await repository.create({ userId: "u1", assetId: "a1" });
    await expect(repository.create({ userId: "u1", assetId: "a1" })).rejects.toBeInstanceOf(
      InvalidWatchlistItemError,
    );
    await expect(repository.create({ userId: "u2", assetId: "a1" })).resolves.toBeDefined();
  });

  it("finds an item by user and asset and returns null otherwise", async () => {
    const repository = build();
    const created = await repository.create({ userId: "u1", assetId: "a1" });
    expect(await repository.getByUserAndAsset("u1", "a1")).toEqual(created);
    expect(await repository.getByUserAndAsset("u1", "a2")).toBeNull();
    expect(await repository.getByUserAndAsset("u2", "a1")).toBeNull();
  });

  it("lists only the given user's items", async () => {
    const repository = build();
    const first = await repository.create({ userId: "u1", assetId: "a1" });
    const second = await repository.create({ userId: "u1", assetId: "a2" });
    await repository.create({ userId: "u2", assetId: "a1" });
    expect(await repository.listByUserId("u1")).toEqual([first, second]);
    expect(await repository.listByUserId("nobody")).toEqual([]);
  });

  it("removes an asset from the watchlist", async () => {
    const repository = build();
    await repository.create({ userId: "u1", assetId: "a1" });
    await repository.deleteByUserAndAsset("u1", "a1");
    expect(await repository.getByUserAndAsset("u1", "a1")).toBeNull();
  });

  it("throws when removing an asset that is not on the watchlist", async () => {
    await expect(build().deleteByUserAndAsset("u1", "a1")).rejects.toThrow();
  });
});
