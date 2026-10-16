import { describe, expect, it } from "vitest";
import { PortfolioStatus } from "@trading/domain";
import { InMemoryPortfolioRepository } from "./in-memory-portfolio-repository.js";

const input = { userId: "u1", name: "Growth", baseCurrency: "USD" };

function build() {
  let tick = 0;
  return new InMemoryPortfolioRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryPortfolioRepository", () => {
  it("creates a portfolio with an id, ACTIVE status and no description by default", async () => {
    const created = await build().create(input);
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({ ...input, description: null, status: PortfolioStatus.ACTIVE });
    expect(created.updatedAt).toEqual(created.createdAt);
  });

  it("keeps an explicit description and status", async () => {
    const created = await build().create({
      ...input,
      description: "Long term",
      status: PortfolioStatus.ARCHIVED,
    });
    expect(created.description).toBe("Long term");
    expect(created.status).toBe(PortfolioStatus.ARCHIVED);
  });

  it("gives every portfolio its own id", async () => {
    const repository = build();
    const first = await repository.create(input);
    const second = await repository.create(input);
    expect(first.id).not.toBe(second.id);
  });

  it("finds a portfolio by id and returns null for an unknown id", async () => {
    const repository = build();
    const created = await repository.create(input);
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
  });

  it("lists only the portfolios of the given user", async () => {
    const repository = build();
    const mine = await repository.create(input);
    await repository.create({ ...input, userId: "u2" });
    expect(await repository.listByUserId("u1")).toEqual([mine]);
    expect(await repository.listByUserId("nobody")).toEqual([]);
  });

  it("updates only the given fields and moves updatedAt", async () => {
    const repository = build();
    const created = await repository.create(input);
    const updated = await repository.update(created.id, { name: "Renamed" });
    expect(updated).toMatchObject({ ...input, name: "Renamed", id: created.id });
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(await repository.getById(created.id)).toEqual(updated);
  });

  it("archives through update", async () => {
    const repository = build();
    const created = await repository.create(input);
    const updated = await repository.update(created.id, { status: PortfolioStatus.ARCHIVED });
    expect(updated.status).toBe(PortfolioStatus.ARCHIVED);
  });

  it("throws when updating or deleting a portfolio that does not exist", async () => {
    const repository = build();
    await expect(repository.update("ghost", { name: "x" })).rejects.toThrow();
    await expect(repository.delete("ghost")).rejects.toThrow();
  });

  it("deletes a portfolio", async () => {
    const repository = build();
    const created = await repository.create(input);
    await repository.delete(created.id);
    expect(await repository.getById(created.id)).toBeNull();
  });
});
