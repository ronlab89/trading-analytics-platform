# B7.2 API Dockerfile

Source: roadmap B7; ADR-006 point 4 (Dockerfile, entrypoint, healthcheck, time zone); `14-deployment-spec.md` §26 and §51. Depends on: B7.1. Branch: `feat/b7-2-api-dockerfile`.

Working rules: as B7.1.

## Allowed edit surfaces

apps/api/Dockerfile
.dockerignore
docs/**
README.md
odd/tasks/b7/**

## Specs

- S1 `apps/api/Dockerfile` is multi-stage and is built with the workspace root as the build context (ADR-006 point 4).
- S2 The final stage runs as a non-root user.
- S3 The entrypoint is `node dist/index.js` in exec form, with no shell and no package-manager wrapper, so `SIGTERM` reaches the process and the shutdown of ADR-006 point 12 runs.
- S4 `TZ=UTC` is set in the image.
- S5 The container healthcheck probes `GET /health/ready`, using a tool that exists in the final image (decision D1).
- S6 The image contains the generated Prisma client and the engine for its base image, and no dev dependencies, no `.env` file and no tests.
- S7 A root `.dockerignore` keeps `node_modules`, `.env*`, `dist`, `.git` and `generated` out of the context.

## Decisions to approve

- D1 Recommended: the healthcheck runs `node -e "fetch(...)"` against the readiness route, so the image needs no `curl` or `wget` and no shell is added to the final stage for the entrypoint. The HEALTHCHECK instruction may use shell form; the entrypoint does not.
- D2 Recommended: a Debian slim base (`node:<.nvmrc major>-slim`) with `openssl`, because Prisma 6 ships the matching engine and Alpine adds a musl `binaryTargets` entry for little gain. T1 confirms the Node major from `.nvmrc`.
- D3 Recommended: `pnpm deploy --prod` (or `pnpm install --prod --frozen-lockfile` over the built workspace) to produce the runtime tree; T1 picks the one that works with the `workspace:` links.

## Tasks

- [x] T1 Build stage: install with the lockfile, `prisma generate`, `pnpm build`.
- [x] T2 Runtime stage: production tree, non-root user, `TZ=UTC`, entrypoint, healthcheck.
- [x] T3 `.dockerignore` and a manual check: `docker build`, `docker run` against the local PostgreSQL, `docker stop` shows the graceful shutdown log.
- [x] T4 Docs: `14-deployment-spec.md` marks, README line to build the image.

## Done when

`docker build -f apps/api/Dockerfile .` produces an image that starts, reports healthy and stops on `SIGTERM` within the drain time.

## Risk

Item 5 (delivery or environment). Item 2 only in that the image must not carry secrets (S6 covers it).

## Verification

docker build; docker run with a real `DATABASE_URL`; docker inspect shows the user, `TZ` and health status; docker stop shows exit code 0; pnpm docs:check.

## Log

L1 Request: as B7.1 (the task files for B7).
L2 Docker was not run by the assistant while writing this plan; D1 to D3 wait for approval and T1 verifies them.
L3 Done 2026-10-25. D1-D3 approved as recommended, with one change to D3: `pnpm deploy` drops `packages/database/generated` (`files` lists only `dist`), so the runtime tree is `pnpm install --prod --frozen-lockfile --ignore-scripts` plus the built `dist` and `generated`.
L4 Compiled `*.test.*` files are deleted from every `dist` in the build stage (S6). `.dockerignore` landed with T1 because the build stage needs it. Verified: docker build; healthy; user `node`, `TZ=UTC`; `docker stop` exit 0 with `app.shutdown.started` and `app.shutdown.completed`. The dev DB lacks the `alerts.armed` migration, so the simulator logs errors; the image is not the cause.
L5 `ARG NODE_VERSION=24` mirrors `.nvmrc` by hand; CI does not pass it yet.
