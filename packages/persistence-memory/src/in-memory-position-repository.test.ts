import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { InMemoryPositionRepository } from "./in-memory-position-repository.js";

function input(portfolioId: string, assetId: string, quantity = 10) {
  return {
    portfolioId,
    assetId,
    quantity,
    averageEntryPrice: Money.of("100", "USD"),
    currentPrice: Money.of("110", "USD"),
  };
}

function build() {
  let tick = 0;
  return new InMemoryPositionRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryPositionRepository", () => {
  it("opens a position with an id and the same openedAt and updatedAt", async () => {
    const created = await build().upsert(input("p1", "a1"));
    expect(created.id).not.toBe("");
    expect(created).toMatchObject(input("p1", "a1"));
    expect(created.updatedAt).toEqual(created.openedAt);
  });

  it("updates the existing position of the same portfolio and asset, keeping id and openedAt", async () => {
    const repository = build();
    const opened = await repository.upsert(input("p1", "a1", 10));
    const updated = await repository.upsert(input("p1", "a1", 15));
    expect(updated.id).toBe(opened.id);
    expect(updated.quantity).toBe(15);
    expect(updated.openedAt).toEqual(opened.openedAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(opened.updatedAt.getTime());
    expect(await repository.listByPortfolioId("p1")).toHaveLength(1);
  });

  it("finds a position by id and by portfolio and asset, and returns null for unknown ones", async () => {
    const repository = build();
    const created = await repository.upsert(input("p1", "a1"));
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
    expect(await repository.getByPortfolioAndAsset("p1", "a1")).toEqual(created);
    expect(await repository.getByPortfolioAndAsset("p1", "a2")).toBeNull();
    expect(await repository.getByPortfolioAndAsset("p2", "a1")).toBeNull();
  });

  it("lists only the positions of the given portfolio", async () => {
    const repository = build();
    const first = await repository.upsert(input("p1", "a1"));
    const second = await repository.upsert(input("p1", "a2"));
    await repository.upsert(input("p2", "a1"));
    expect(await repository.listByPortfolioId("p1")).toEqual([first, second]);
    expect(await repository.listByPortfolioId("nobody")).toEqual([]);
  });

  it("updates the current price only", async () => {
    const repository = build();
    const created = await repository.upsert(input("p1", "a1"));
    const updated = await repository.updateCurrentPrice(created.id, Money.of("120", "USD"));
    expect(updated.currentPrice).toEqual(Money.of("120", "USD"));
    expect(updated.quantity).toBe(created.quantity);
    expect(updated.averageEntryPrice).toEqual(created.averageEntryPrice);
    expect(await repository.getById(created.id)).toEqual(updated);
  });

  it("deletes the position of a portfolio and asset", async () => {
    const repository = build();
    await repository.upsert(input("p1", "a1"));
    await repository.upsert(input("p1", "a2"));
    await repository.deleteByPortfolioAndAsset("p1", "a1");
    expect(await repository.getByPortfolioAndAsset("p1", "a1")).toBeNull();
    expect(await repository.listByPortfolioId("p1")).toHaveLength(1);
  });

  it("throws when updating the price of, or deleting, a position that does not exist", async () => {
    const repository = build();
    await expect(repository.updateCurrentPrice("ghost", Money.of("1", "USD"))).rejects.toThrow();
    await expect(repository.deleteByPortfolioAndAsset("p1", "a1")).rejects.toThrow();
  });
});
