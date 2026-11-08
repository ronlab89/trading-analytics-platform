import type { CreateUserInput } from "@trading/domain";

/**
 * The single demo user seeded into the database.
 * Source: 12-demo-mode-spec.md §13 — "1 demo user".
 */
export const SEED_USER: CreateUserInput = {
  email: "demo@trading-analytics.dev",
  displayName: "Demo Trader",
};
