import { spawnSync } from "node:child_process";
import { assertNotProduction } from "../src/seed/seed-guard.js";

try {
  assertNotProduction("reset");
} catch (error: unknown) {
  console.error(`[reset] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "reset", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
