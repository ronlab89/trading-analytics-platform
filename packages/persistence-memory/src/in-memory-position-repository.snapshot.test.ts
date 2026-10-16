import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { InMemoryPositionRepository } from "./in-memory-position-repository.js";

function input(assetId: string, quantity = 10) {
  return {
    portfolioId: "p1",
    assetId,
    quantity,
    averageEntryPrice: Money.of("100", "USD"),
    currentPrice: Money.of("110", "USD"),
  };
}

describe("InMemoryPositionRepository snapshot and restore", () => {
  it("restore discards every write made after the snapshot", async () => {
    const repository = new InMemoryPositionRepository();
    const kept = await repository.upsert(input("a1", 10));
    const snapshot = repository.snapshot();

    await repository.upsert(input("a1", 99));
    await repository.upsert(input("a2"));
    await repository.deleteByPortfolioAndAsset("p1", "a1");
    repository.restore(snapshot);

    expect(await repository.listByPortfolioId("p1")).toEqual([kept]);
  });

  it("restore also rewinds the id sequence", async () => {
    const repository = new InMemoryPositionRepository();
    const snapshot = repository.snapshot();
    const first = await repository.upsert(input("a1"));

    repository.restore(snapshot);
    const again = await repository.upsert(input("a1"));

    expect(again.id).toBe(first.id);
  });

  it("a snapshot is not changed by later writes and can be restored twice", async () => {
    const repository = new InMemoryPositionRepository();
    const snapshot = repository.snapshot();

    await repository.upsert(input("a1"));
    repository.restore(snapshot);
    await repository.upsert(input("a2"));
    repository.restore(snapshot);

    expect(await repository.listByPortfolioId("p1")).toEqual([]);
  });
});
