import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./client.js";

describe("runtime database role", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects as trading_runtime, not as the migration role", async () => {
    const rows = await prisma.$queryRaw<{ current_user: string }[]>`SELECT current_user`;
    expect(rows[0]?.current_user).toBe("trading_runtime");
  });

  it("can read and write rows", async () => {
    await expect(prisma.user.count()).resolves.toBeTypeOf("number");
  });

  it.each([
    ["create a table", `CREATE TABLE runtime_role_probe (id int)`],
    ["alter a table", `ALTER TABLE users ADD COLUMN runtime_role_probe int`],
    ["drop a table", `DROP TABLE users`],
    ["read migration bookkeeping", `SELECT * FROM _prisma_migrations`],
  ])("cannot %s", async (_label, statement) => {
    await expect(prisma.$executeRawUnsafe(statement)).rejects.toThrow(
      /permission denied|must be owner/i,
    );
  });
});
