import { describe, expect, it } from "vitest";
import { AlertType } from "@trading/domain";
import { InMemoryAlertRepository } from "./in-memory-alert-repository.js";

function input(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    type: AlertType.PRICE,
    condition: "ABOVE",
    threshold: 100,
    ...overrides,
  };
}

function build() {
  let tick = 0;
  return new InMemoryAlertRepository({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

describe("InMemoryAlertRepository", () => {
  it("creates an enabled alert with an id and no asset or portfolio by default", async () => {
    const created = await build().create(input());
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({ ...input(), assetId: null, portfolioId: null, enabled: true });
    expect(created.updatedAt).toEqual(created.createdAt);
  });

  it("keeps explicit asset, portfolio and enabled flag", async () => {
    const created = await build().create(
      input({ assetId: "a1", portfolioId: "p1", enabled: false }),
    );
    expect(created).toMatchObject({ assetId: "a1", portfolioId: "p1", enabled: false });
  });

  it("finds an alert by id and returns null for an unknown id", async () => {
    const repository = build();
    const created = await repository.create(input());
    expect(await repository.getById(created.id)).toEqual(created);
    expect(await repository.getById("ghost")).toBeNull();
  });

  it("lists only the given user's alerts", async () => {
    const repository = build();
    const first = await repository.create(input());
    const second = await repository.create(input());
    await repository.create(input({ userId: "u2" }));
    expect(await repository.listByUserId("u1")).toEqual([first, second]);
    expect(await repository.listByUserId("nobody")).toEqual([]);
  });

  it("updates only the given fields and moves updatedAt", async () => {
    const repository = build();
    const created = await repository.create(input());
    const updated = await repository.update(created.id, { enabled: false, threshold: 150 });
    expect(updated).toMatchObject({ ...input(), enabled: false, threshold: 150 });
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(await repository.getById(created.id)).toEqual(updated);
  });

  it("deletes an alert", async () => {
    const repository = build();
    const created = await repository.create(input());
    await repository.delete(created.id);
    expect(await repository.getById(created.id)).toBeNull();
  });

  it("throws when updating or deleting an alert that does not exist", async () => {
    const repository = build();
    await expect(repository.update("ghost", { enabled: false })).rejects.toThrow();
    await expect(repository.delete("ghost")).rejects.toThrow();
  });
});
