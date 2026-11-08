import { describe, expect, it } from "vitest";
import { ScenarioStatus } from "@trading/domain";
import { InMemoryScenarioRepository } from "./in-memory-scenario-repository.js";

const change = { assetId: "a1", percentChange: -12 };

function build() {
  let tick = 0;
  return new InMemoryScenarioRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryScenarioRepository", () => {
  it("creates a DRAFT scenario with an id, no description or snapshot and no changes", async () => {
    const created = await build().create({ portfolioId: "p1", name: "Crash" });
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({
      portfolioId: "p1",
      name: "Crash",
      description: null,
      baseSnapshotId: null,
      status: ScenarioStatus.DRAFT,
      changes: [],
    });
    expect(created.updatedAt).toEqual(created.createdAt);
  });

  it("keeps explicit description, snapshot, status and changes", async () => {
    const created = await build().create({
      portfolioId: "p1",
      name: "Crash",
      description: "d",
      baseSnapshotId: "s1",
      status: ScenarioStatus.SAVED,
      changes: [change],
    });
    expect(created).toMatchObject({
      description: "d",
      baseSnapshotId: "s1",
      status: ScenarioStatus.SAVED,
      changes: [change],
    });
  });

  it("finds a scenario by id and returns null for an unknown id", async () => {
    const repository = build();
    const created = await repository.create({ portfolioId: "p1", name: "A" });
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
  });

  it("lists one portfolio's scenarios, newest first", async () => {
    const repository = build();
    const first = await repository.create({ portfolioId: "p1", name: "first" });
    const second = await repository.create({ portfolioId: "p1", name: "second" });
    await repository.create({ portfolioId: "p2", name: "other" });
    expect(await repository.listByPortfolioId("p1")).toEqual([second, first]);
    expect(await repository.listByPortfolioId("nobody")).toEqual([]);
  });

  it("orders scenarios created at the same instant by creation, oldest first, even past nine", async () => {
    const repository = new InMemoryScenarioRepository({ now: () => new Date("2026-01-01") });
    const created = [];
    for (let i = 0; i < 11; i++) {
      created.push(await repository.create({ portfolioId: "p1", name: `s${String(i)}` }));
    }
    const listed = await repository.listByPortfolioId("p1");
    expect(listed.map((s) => s.id)).toEqual(created.map((s) => s.id));
  });

  it("updates only the given fields and moves updatedAt", async () => {
    const repository = build();
    const created = await repository.create({ portfolioId: "p1", name: "A", changes: [change] });
    const updated = await repository.update(created.id, {
      name: "B",
      status: ScenarioStatus.SAVED,
    });
    expect(updated).toMatchObject({ name: "B", status: ScenarioStatus.SAVED, changes: [change] });
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(await repository.getById(created.id)).toEqual(updated);
  });

  it("replaces the changes as a whole", async () => {
    const repository = build();
    const created = await repository.create({ portfolioId: "p1", name: "A", changes: [change] });
    const replacement = [{ assetId: "a2", percentChange: 5 }];
    const updated = await repository.updateChanges(created.id, replacement);
    expect(updated.changes).toEqual(replacement);
    expect(updated.name).toBe("A");
  });

  it("deletes a scenario", async () => {
    const repository = build();
    const created = await repository.create({ portfolioId: "p1", name: "A" });
    await repository.delete(created.id);
    expect(await repository.getById(created.id)).toBeNull();
  });

  it("throws when updating, replacing the changes of, or deleting a scenario that does not exist", async () => {
    const repository = build();
    await expect(repository.update("ghost", { name: "x" })).rejects.toThrow();
    await expect(repository.updateChanges("ghost", [])).rejects.toThrow();
    await expect(repository.delete("ghost")).rejects.toThrow();
  });
});
