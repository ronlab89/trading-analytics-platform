import { prisma } from "@trading/database";

/**
 * Runs a lightweight query against Postgres through the shared
 * @trading/database client to confirm the database is reachable.
 * Throws on failure — callers (the readiness controller) are
 * responsible for catching and translating into an "unavailable"
 * response. See 13-observability-spec.md §23.
 */
export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
