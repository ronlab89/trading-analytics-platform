import { describe, expect, it } from "vitest";
import { InMemoryJobRepository } from "./in-memory-job-repository.js";

const input = {
  userId: "user-1",
  portfolioId: "portfolio-1",
  type: "CSV_IMPORT" as const,
  input: "date,type\n",
  queuedAt: new Date("2026-10-21T10:00:00.000Z"),
  deadlineAt: new Date("2026-10-21T10:05:00.000Z"),
};

describe("InMemoryJobRepository", () => {
  it("uses the injected clock for createdAt and updatedAt", async () => {
    const now = new Date("2026-10-21T09:00:00.000Z");
    const repository = new InMemoryJobRepository({ now: () => now });

    const created = await repository.create(input);

    expect(created.createdAt).toEqual(now);
    expect(created.updatedAt).toEqual(now);
  });

  it("restores the state a snapshot captured", async () => {
    const repository = new InMemoryJobRepository();
    const kept = await repository.create(input);
    const snapshot = repository.snapshot();
    const dropped = await repository.create(input);

    repository.restore(snapshot);

    expect(await repository.getById(kept.id)).toEqual(kept);
    expect(await repository.getById(dropped.id)).toBeNull();
    expect((await repository.create(input)).id).toBe(dropped.id);
  });
});
