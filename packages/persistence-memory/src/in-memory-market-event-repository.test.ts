import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { InMemoryMarketEventRepository } from "./in-memory-market-event-repository.js";

function input(assetId: string, sequence: number, price = "100") {
  return { assetId, price: Money.of(price, "USD"), sequence };
}

function build() {
  return new InMemoryMarketEventRepository({ now: () => new Date("2026-01-01T00:00:00Z") });
}

describe("InMemoryMarketEventRepository", () => {
  it("creates an event with an id and the timestamp from now", async () => {
    const created = await build().create(input("a1", 1));
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({
      assetId: "a1",
      sequence: 1,
      price: Money.of("100", "USD"),
      timestamp: new Date("2026-01-01T00:00:00Z"),
    });
  });

  it("lists one asset's events ordered by sequence, whatever the insertion order", async () => {
    const repository = build();
    await repository.create(input("a1", 3));
    await repository.create(input("a1", 1));
    await repository.create(input("a1", 2));
    await repository.create(input("a2", 9));
    const listed = await repository.listByAssetId("a1");
    expect(listed.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(await repository.listByAssetId("nobody")).toEqual([]);
  });

  it("orders sequences numerically, not as text", async () => {
    const repository = build();
    for (const sequence of [10, 9, 100, 2]) {
      await repository.create(input("a1", sequence));
    }
    expect((await repository.listByAssetId("a1")).map((e) => e.sequence)).toEqual([2, 9, 10, 100]);
  });

  it("returns only the events after the given sequence, excluding it", async () => {
    const repository = build();
    for (const sequence of [1, 2, 3, 4]) {
      await repository.create(input("a1", sequence));
    }
    const listed = await repository.listByAssetId("a1", 2);
    expect(listed.map((e) => e.sequence)).toEqual([3, 4]);
    expect(await repository.listByAssetId("a1", 0)).toHaveLength(4);
  });

  it("returns the highest sequence of an asset, or null when it has no events", async () => {
    const repository = build();
    await repository.create(input("a1", 5));
    await repository.create(input("a1", 12));
    await repository.create(input("a1", 7));
    await repository.create(input("a2", 99));
    expect(await repository.getLastSequence("a1")).toBe(12);
    expect(await repository.getLastSequence("nobody")).toBeNull();
  });
});
