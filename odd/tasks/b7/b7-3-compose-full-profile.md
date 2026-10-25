# B7.3 Compose full profile

Source: roadmap B7 (Compose, deferred details); ADR-006 points 4 and 5 and its Deferred detail; ADR-005 point 13; `14-deployment-spec.md` §15, §19, §26. Depends on: B7.2. Branch: `feat/b7-3-compose-full-profile`.

Working rules: as B7.1.

## Allowed edit surfaces

docker-compose.yml
apps/api/Dockerfile
packages/database/prisma/set-runtime-password.ts
packages/database/package.json
docs/**
README.md
odd/tasks/b7/**

## Findings that shape the plan

- F1 `.env.example` is blocked for the assistant: any new variable it needs is a line the user adds.
- F2 `schema.prisma` reads `DATABASE_URL` (runtime role `trading_runtime`) and `directUrl = MIGRATION_DATABASE_URL` (superuser). The `migrate` service must use the migration role and the API the runtime role.
- F3 The runtime role has no password until `db:runtime-password` runs (`set-runtime-password.ts`, a TypeScript script run with `tsx`). The `full` profile therefore needs that step before the API starts, or the API cannot log in.
- F4 PostgreSQL publishes `${DATABASE_PORT:-5432}` on every host interface; `14` §6 leaves a `127.0.0.1` binding open for B7.

## Specs

- S1 The default profile keeps only PostgreSQL; the `full` profile adds `migrate` and `api`.
- S2 `migrate` is a one-shot service that runs `prisma migrate deploy`, with `depends_on` PostgreSQL and `condition: service_healthy`.
- S3 `api` has `depends_on: migrate` with `condition: service_completed_successfully`.
- S4 The seed never runs automatically (ADR-006 point 5).
- S5 The API and PostgreSQL containers run with `TZ=UTC`.
- S6 `connection_limit` of the Prisma pool stays at Prisma's default until measured (ADR-006 Deferred detail).
- S7 The runtime role has its password set before the API starts (decision D1).
- S8 PostgreSQL is published on `127.0.0.1` only (decision D2).

## Decisions to approve

- D1 Recommended: the `migrate` service runs `prisma migrate deploy` and then the runtime-password script in the same one-shot, so the dependency chain stays PostgreSQL, then `migrate`, then `api`. The entrypoint rule (no shell wrapper) applies to the API image only. If the script cannot run from the production tree, compile it instead of adding `tsx` to the image.
- D2 Recommended: bind the published port to `127.0.0.1` in the default profile too; it closes the open item in `14` §6 and breaks nobody, since the dev database is reached from the same machine. Needs a one-line decision because it changes the default profile.
- D3 The API in the `full` profile reaches the database through the Compose network name (`postgres`), not `localhost`; the compose file builds both URLs from the same `DATABASE_*` variables the default profile uses.

## Tasks

- [x] T1 `migrate` service with the health dependency and the runtime-password step.
- [x] T2 `api` service: build context, URLs, `TZ`, healthcheck, `depends_on` migrate, profile `full`.
- [x] T3 Port binding (D2), the lines the user adds to `.env.example`, and a manual run: `docker compose --profile full up --build`.
- [x] T4 Docs: `14` marks and README commands for the two profiles.

## Done when

`docker compose --profile full up` brings PostgreSQL, migrations and a healthy API up in order from an empty volume, and the default profile still starts PostgreSQL alone.

## Risk

Item 5 (delivery or environment). Item 2 for the credentials wiring and the port binding.

## Verification

docker compose config for both profiles; docker compose --profile full up from a clean volume; docker compose ps shows migrate exited 0 and api healthy; psql shows the schema and no seeded rows; pnpm docs:check.

## Log

L1 Request: as B7.1 (the task files for B7).
L2 The roadmap and ADR-006 (points 4 and 5, amended 2026-10-07) agree: `migrate` is a separate one-shot service, not part of the entrypoint. The earlier note that placed `migrate deploy` in the entrypoint was stale.
L3 Done 2026-10-25. D1 to D3 approved as recommended. `migrate` is a Dockerfile target (`FROM build`) instead of the production tree, because the runtime image has no Prisma CLI or `tsx`; the runtime-password step runs in the same `sh -c` after `prisma migrate deploy`.
L4 Verified in an isolated project (`-p b73`, own volume and ports, then removed): migrate exited 0, api healthy, 17 migrations applied, `trading_runtime` has a password, timezone `UTC`, `/health/ready` 200, no error logs, PostgreSQL published on 127.0.0.1. Row counts of the seed were not queried; no service runs the seed.
L5 `.env.example` is blocked for the assistant: the user may add `RUNTIME_DB_PASSWORD` and `API_PORT` there; both have defaults in Compose.
