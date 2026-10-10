# B0.2 Configuration safety and security details

Source: roadmap B0 lines 128-131 and 198-203; ADR-005 point 13; ADR-006 point 13. Depends on: B0.1 (merged, PR #16). Branch: `feat/b0-2-config-security`.

## Allowed edit surfaces

apps/api/src/config/env.ts
apps/api/src/config/env.test.ts
apps/api/src/services/auth.service.ts
apps/api/src/services/auth.service.test.ts
packages/database/src/seed/index.ts
packages/database/src/seed/wipe.ts
packages/database/src/seed/seed-guard.ts
packages/database/src/seed/seed-guard.test.ts
packages/database/prisma/seed.ts
packages/database/prisma/reset.ts
packages/database/prisma/schema.prisma
packages/database/prisma/set-runtime-password.ts
packages/database/src/runtime-role.test.ts
packages/database/package.json
packages/database/prisma/migrations/\*\*
docker-compose.yml
.github/workflows/ci.yml
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md
docs/14-deployment-spec.md
docs/15-implementation-plan.md

## Pre-flight state (checked 2026-10-09)

- `apps/api/src/config/env.ts` exists and validates `CORS_ORIGIN` with Zod (line 8); no `env.test.ts` yet.
- `apps/api/src/services/auth.service.ts` exists; no `auth.service.test.ts` yet. Tests live next to the code (`apps/api/src/app.test.ts`, helpers in `apps/api/src/test-utils/`).
- The seed entry is `packages/database/src/seed/index.ts`, which calls `wipeDatabase()` (`wipe.ts`) first. `prisma/seed.ts` is the Prisma hook entry.
- The hard reset is `db:reset` = `prisma migrate reset` in `packages/database/package.json`; there is no code file for it.
- `.env.example` is outside the permission settings for the agent (denied read). If a task needs it, ask the user to apply that edit or lift the rule.

## Open design questions (decide with the user before T2 and T4)

- T2: where the guard for `prisma migrate reset` lives (a wrapper script around `db:reset`, or a check in a small Node entry the script calls).
- T4: how the two roles are created (a migration with `CREATE ROLE`, or an init script mounted in Compose), how passwords are supplied locally and in CI, and which `DATABASE_URL` each script uses (runtime for the API and the test suites, migration for `migrate deploy`).

## Tasks

- [x] T1 RED then GREEN: `CORS_ORIGIN` accepts only `http(s)://host[:port]`, rejects `*`. Route: inline (2 small files). Evidence: `env.test.ts` 8/8 green, `tsc --noEmit` clean.
- [x] T2 Seed and hard reset refuse to run when `NODE_ENV=production`. Decision: shared `assertNotProduction` in `seed-guard.ts`; `db:reset` now runs `prisma/reset.ts` (Node entry, portable on Windows). Route: inline. Evidence: `seed-guard.test.ts` 5/5 green, `tsc --noEmit` clean, `NODE_ENV=production tsx prisma/reset.ts` exits 1.
- [x] T3 Login timing: run `bcryptjs` against a fixed dummy hash when the user does not exist; generic message unchanged. Route: inline. Evidence: `auth.service.test.ts` 2/2 green (mocked repos, no DB), `tsc --noEmit` clean. Not run: `auth.routes.test.ts` (needs the test DB).
- [x] T4 Runtime database role without DDL; only the migration role keeps DDL; wire the roles in Compose and CI. Decision: migration `20261010120000_add_runtime_role` (idempotent `CREATE ROLE trading_runtime`, DML-only grants, default privileges); password set by `prisma/set-runtime-password.ts` from `RUNTIME_DB_PASSWORD`; `directUrl = MIGRATION_DATABASE_URL` in `schema.prisma`; CI wired. Verified locally against Postgres 18 as `trading_runtime`: database 108/108 (incl. `runtime-role.test.ts` 6/6), api 186/186, `pnpm typecheck` clean. The CI run is still pending. The user applied the env changes (`MIGRATION_DATABASE_URL`, `RUNTIME_DB_PASSWORD`) by hand; the agent cannot read the env files. Compose needs no change (its `POSTGRES_USER` is the migration role).
- [ ] T5 Status lines: the CI database roles and the runtime role become `Implemented` in the SDD (after the CI run is green).

## Done when

Tests exist for each task and pass; the API still boots against the runtime role.

## Verification

pnpm --filter @trading/api test; pnpm --filter @trading/database test; pnpm typecheck. Running tests needs the local test database (`.env.test.local`); the user runs them or authorizes the agent to.
