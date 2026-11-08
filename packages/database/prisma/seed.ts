import { seedDatabase } from "../src/seed/index.js";
import { prisma } from "../src/client.js";

try {
  await seedDatabase();
} catch (error: unknown) {
  console.error("[seed] failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
