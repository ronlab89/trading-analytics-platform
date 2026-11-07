import { describe, expect, it } from "vitest";
import { demoEmailFor, readDemoRole, saveDemoRole } from "./demo-role";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("demo role", () => {
  it("builds the email the demo reads the role from", () => {
    expect(demoEmailFor("VIEWER")).toBe("viewer@demo.example");
    expect(demoEmailFor("ADMIN")).toBe("admin@demo.example");
  });

  it("defaults to the trader and ignores a stored value it does not know", () => {
    expect(readDemoRole(memoryStorage())).toBe("TRADER");
    expect(readDemoRole(memoryStorage({ "trading-demo:role": "OWNER" }))).toBe("TRADER");
  });

  it("remembers the role under the demo prefix", () => {
    const storage = memoryStorage();

    saveDemoRole("ADMIN", storage);

    expect(readDemoRole(storage)).toBe("ADMIN");
  });
});
