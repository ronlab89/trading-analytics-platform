# B0.2 Configuration safety and security details

Source: roadmap B0 lines 128-131 and 198-203; ADR-005 point 13; ADR-006 point 13. Depends on: B0.1.

## Allowed edit surfaces

apps/api/src/config/env.ts
apps/api/src/config/env.test.ts
apps/api/src/services/auth.service.ts
apps/api/src/services/auth.service.test.ts
packages/database/prisma/seed.ts
packages/database/src/**/reset\*.ts
packages/database/prisma/migrations/**
docker-compose*.yml
.env.example
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Tasks

- [ ] T1 RED then GREEN: `CORS_ORIGIN` accepts only `http(s)://host[:port]`, rejects `*`.
- [ ] T2 Seed and hard reset refuse to run when `NODE_ENV=production`.
- [ ] T3 Login timing: run `bcryptjs` against a fixed dummy hash when the user does not exist; generic message unchanged.
- [ ] T4 Runtime database role without DDL; only the migration role keeps DDL; wire the roles in Compose and CI.

## Done when

Tests exist for each task and pass; the API still boots against the runtime role.

## Verification

pnpm --filter @trading/api test; pnpm --filter @trading/database test; pnpm typecheck.
