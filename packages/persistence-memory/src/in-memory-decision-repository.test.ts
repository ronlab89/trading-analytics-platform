import { describe, expect, it } from "vitest";
import { DecisionDirection, Money } from "@trading/domain";
import { InMemoryDecisionRepository } from "./in-memory-decision-repository.js";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function input(overrides: Record<string, unknown> = {}) {
  return {
    portfolioId: "p1",
    assetId: "a1",
    title: "Buy the dip",
    thesis: "Earnings are underpriced",
    direction: DecisionDirection.LONG,
    ...overrides,
  };
}

function build() {
  return new InMemoryDecisionRepository({ now: () => day(30) });
}

describe("InMemoryDecisionRepository", () => {
  it("creates an open decision with null optional fields and createdAt from now", async () => {
    const created = await build().create(input());
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({
      ...input(),
      entryPrice: null,
      targetPrice: null,
      stopPrice: null,
      riskLevel: null,
      notes: null,
      closedAt: null,
      outcome: null,
      createdAt: day(30),
    });
  });

  it("keeps explicit prices, notes and a historical createdAt", async () => {
    const created = await build().create(
      input({
        entryPrice: Money.of("100", "USD"),
        targetPrice: Money.of("120", "USD"),
        notes: "n",
        createdAt: day(3),
      }),
    );
    expect(created.entryPrice).toEqual(Money.of("100", "USD"));
    expect(created.targetPrice).toEqual(Money.of("120", "USD"));
    expect(created.notes).toBe("n");
    expect(created.createdAt).toEqual(day(3));
  });

  it("finds a decision by id and returns null for an unknown id", async () => {
    const repository = build();
    const created = await repository.create(input());
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
  });

  it("lists one portfolio's decisions, newest first", async () => {
    const repository = build();
    const old = await repository.create(input({ createdAt: day(2) }));
    const recent = await repository.create(input({ createdAt: day(20) }));
    await repository.create(input({ portfolioId: "p2" }));
    expect(await repository.listByPortfolioId("p1")).toEqual([recent, old]);
  });

  it("orders decisions that share a createdAt by creation, newest first, even past nine", async () => {
    const repository = build();
    const created = [];
    for (let i = 0; i < 11; i++) {
      created.push(await repository.create(input({ createdAt: day(10) })));
    }
    const listed = await repository.listByPortfolioId("p1");
    expect(listed.map((d) => d.id)).toEqual(created.map((d) => d.id).reverse());
  });

  it("filters by asset, direction and an inclusive createdAt range", async () => {
    const repository = build();
    await repository.create(input({ assetId: "a1", createdAt: day(5) }));
    await repository.create(input({ assetId: "a2", createdAt: day(10) }));
    await repository.create(input({ direction: DecisionDirection.SHORT, createdAt: day(15) }));
    await repository.create(input({ createdAt: day(25) }));
    const found = async (filter: Parameters<typeof repository.listByPortfolioId>[1]) =>
      (await repository.listByPortfolioId("p1", filter)).map((d) => d.createdAt);

    expect(await found({ assetId: "a2" })).toEqual([day(10)]);
    expect(await found({ direction: DecisionDirection.SHORT })).toEqual([day(15)]);
    expect(await found({ dateFrom: day(10), dateTo: day(15) })).toEqual([day(15), day(10)]);
    expect(await found({ dateFrom: day(20) })).toEqual([day(25)]);
    expect(await found({ dateTo: day(5) })).toEqual([day(5)]);
  });

  it("updates only the given fields and clears a price with null", async () => {
    const repository = build();
    const created = await repository.create(input({ targetPrice: Money.of("120", "USD") }));
    const renamed = await repository.update(created.id, { title: "New title" });
    expect(renamed).toEqual({ ...created, title: "New title" });
    const cleared = await repository.update(created.id, { targetPrice: null });
    expect(cleared.targetPrice).toBeNull();
    expect(cleared.title).toBe("New title");
    expect(await repository.getById(created.id)).toEqual(cleared);
  });

  it("closes a decision with its outcome and closing date", async () => {
    const repository = build();
    const created = await repository.create(input());
    const closed = await repository.close(created.id, "Target hit", day(12));
    expect(closed).toMatchObject({ outcome: "Target hit", closedAt: day(12) });
    expect(await repository.getById(created.id)).toEqual(closed);
  });

  it("throws when updating or closing a decision that does not exist", async () => {
    const repository = build();
    await expect(repository.update("ghost", { title: "x" })).rejects.toThrow();
    await expect(repository.close("ghost", "x", day(1))).rejects.toThrow();
  });
});
