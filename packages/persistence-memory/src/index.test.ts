import { describe, expect, it } from "vitest";

describe("@trading/persistence-memory", () => {
  it("has an entry point the other packages can import", async () => {
    const entry = await import("./index.js");
    expect(entry).toBeDefined();
  });
});
