import { PrismaClient } from "../generated/client/index.js";

/**
 * Sets the password of the `trading_runtime` role from RUNTIME_DB_PASSWORD.
 * Runs with the migration role (MIGRATION_DATABASE_URL), after
 * `prisma migrate deploy`. The password never lands in a migration file.
 */
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const password = process.env.RUNTIME_DB_PASSWORD;

if (!migrationUrl || !password) {
  console.error("[runtime-role] MIGRATION_DATABASE_URL and RUNTIME_DB_PASSWORD are required.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: migrationUrl });

try {
  // ALTER ROLE cannot take bind parameters, so let the server quote the literal.
  const rows = await prisma.$queryRaw<{ statement: string }[]>`
    SELECT format('ALTER ROLE trading_runtime PASSWORD %L', ${password}::text) AS statement
  `;
  const statement = rows[0]?.statement;
  if (!statement) {
    throw new Error("Could not build the ALTER ROLE statement.");
  }
  await prisma.$executeRawUnsafe(statement);
  console.log("[runtime-role] password set for trading_runtime.");
} catch (error: unknown) {
  console.error("[runtime-role] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
