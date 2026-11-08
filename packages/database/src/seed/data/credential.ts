/**
 * The single demo user's login credential.
 *
 * Plaintext password is documented here deliberately — this is synthetic
 * demo/dev seed data, not a real secret (09-security-spec.md §41-42: Demo
 * Mode must never use real credentials).
 *
 * The hash below was pre-computed once with bcrypt (10 rounds) rather than
 * hashed at seed time, so this package does not need `bcryptjs` as a
 * runtime dependency — hashing/verification belongs to apps/api (see
 * packages/domain/src/entities/credential.ts for the rationale on keeping
 * this package infrastructure-agnostic about the hashing algorithm).
 *
 * Demo login: demo@trading-analytics.dev / demo1234
 */
export const SEED_PASSWORD_HASH = "$2b$10$9k.Oj86mq6h.PnD64v6uiemxTOTDW7Jx78utolWim2Ywj82SdzV92";
