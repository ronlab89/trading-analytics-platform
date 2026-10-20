# B3.4 Graceful shutdown and lifecycle entries

Source: roadmap B3 (`docs/BACKEND-ROADMAP.md`); ADR-006 point 12; ADR-009 point 11; `docs/13-observability-spec.md` §23, §57; `docs/14-deployment-spec.md` §16. Depends on: B3.1. Branch: `feat/b3-4-graceful-shutdown`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

apps/api/src/**
docs/13-observability-spec.md
docs/14-deployment-spec.md
docs/07-api-spec.md
docs/adr/0006-deployment-model-and-ci.md
docs/PROGRESS.md

## Specs

- S1 On `SIGTERM` or `SIGINT` the server stops accepting connections, `GET /health/ready` returns 503 with `status: "unavailable"` and no `checks`, in-flight requests drain with a 10-second timeout, Prisma is closed, and the process exits with code 1 if the drain expires and 0 otherwise. (ADR-006 point 12)
- S2 `app.shutdown.started` and `app.shutdown.completed`, and `app.startup.started` and `app.startup.completed`, all at `info`. (ADR-009 point 11; approved default 4, 2026-10-19)
- S3 The shutdown is built so B4 (job runner) and B5 (realtime connections, close code `1001`) can join its sequence: a registry of ordered close steps, not a hard-coded list. (roadmap B3 hooks)
- S4 The container entrypoint stays `node dist/index.js` with no wrapper, so `SIGTERM` reaches the process. (roadmap B0)

## Tasks

- [ ] T1 Verify `index.ts`, `app.ts` and the readiness controller, and decide the testable shape (a `createServer`/`shutdown` function that takes the signal source and a drain timeout, so tests do not send real signals).
- [ ] T2 Startup entries and the shutdown registry.
- [ ] T3 Readiness 503 during shutdown (`status: "unavailable"`, no `checks`) and its test.
- [ ] T4 Drain with timeout, Prisma close and exit codes, tested with an injected timeout and exit function: drain completes (0) and drain expires (1).
- [ ] T5 Reconcile `13`, `14`, `07` and ADR-006 for what landed.

## Done when

The shutdown sequence is tested for both exit codes and for the 503 on readiness; lifecycle entries appear in order.

## Risk

Items 4 (async ordering during shutdown) and 5 (process lifecycle, container signal handling).

## Verification

pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
