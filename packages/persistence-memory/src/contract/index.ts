/**
 * Repository contract suites, run against every implementation of a
 * `@trading/domain` repository (in-memory here, Prisma in `@trading/database`).
 * Source: docs/10-testing-strategy.md §17 (Repository Testing).
 *
 * Each suite takes a factory that builds a fresh repository plus the ids it
 * needs, so an implementation with foreign keys can create real rows while an
 * in-memory one returns any ids.
 */
export * from "./asset-repository.contract.js";
export * from "./notification-repository.contract.js";
export * from "./portfolio-repository.contract.js";
export * from "./user-preference-repository.contract.js";
export * from "./user-repository.contract.js";
