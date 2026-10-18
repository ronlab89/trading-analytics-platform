import { describe, expect, it } from "vitest";
import { InMemorySessionRepository } from "./in-memory-session-repository.js";

const expiresAt = new Date("2026-11-17T00:00:00Z");
const input = { userId: "u1", familyId: "f1", tokenHash: "h1", expiresAt };

describe("InMemorySessionRepository", () => {
  it("stamps createdAt and lastUsedAt with the injected clock", async () => {
    const instant = new Date("2026-10-18T12:00:00Z");
    const repository = new InMemorySessionRepository({ now: () => instant });

    const created = await repository.create(input);

    expect(created.createdAt).toEqual(instant);
    expect(created.lastUsedAt).toEqual(instant);
  });

  it("numbers the sessions in insertion order", async () => {
    const repository = new InMemorySessionRepository();

    const first = await repository.create(input);
    const second = await repository.create({ ...input, tokenHash: "h2" });

    expect([first.id, second.id]).toEqual(["session_1", "session_2"]);
  });

  it("keeps independent repositories isolated from each other", async () => {
    const one = new InMemorySessionRepository();
    const other = new InMemorySessionRepository();
    await one.create(input);

    expect(await other.getByTokenHash("h1")).toBeNull();
  });
});
