import { PrismaClient } from "../generated/client/index.js";

/**
 * PrismaClient singleton.
 *
 * A single shared instance avoids opening a new connection pool on
 * every hot-reload cycle during development (a well-known Prisma +
 * Node dev-server pitfall). Consumers should import `prisma` from
 * here rather than instantiating `new PrismaClient()` themselves.
 *
 * This file is the only place in the codebase that is allowed to
 * import directly from `../generated/client` — every repository
 * implementation imports the shared `prisma` instance from here
 * instead, keeping the raw generated client contained to this one
 * module (06-architecture.md §13, Mock Infrastructure /
 * Infrastructure Is Replaceable — the same isolation principle
 * applies to the real adapter, not just the mock one).
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
