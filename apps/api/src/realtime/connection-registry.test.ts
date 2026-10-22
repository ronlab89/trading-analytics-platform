import { describe, expect, it } from "vitest";
import { createConnectionRegistry } from "./connection-registry.js";

describe("connection registry", () => {
  it("counts the connections of each user", () => {
    const registry = createConnectionRegistry<{ userId: string }>();
    registry.add({ userId: "u1" });
    registry.add({ userId: "u1" });
    registry.add({ userId: "u2" });

    expect(registry.countOf("u1")).toBe(2);
    expect(registry.countOf("u2")).toBe(1);
    expect(registry.countOf("u3")).toBe(0);
    expect(registry.size()).toBe(3);
  });

  it("forgets a removed connection and ignores one it never had", () => {
    const registry = createConnectionRegistry<{ userId: string }>();
    const kept = { userId: "u1" };
    const gone = { userId: "u1" };
    registry.add(kept);
    registry.add(gone);

    registry.remove(gone);
    registry.remove({ userId: "u1" });
    registry.remove({ userId: "u9" });

    expect(registry.countOf("u1")).toBe(1);
    expect(registry.size()).toBe(1);
  });
});
