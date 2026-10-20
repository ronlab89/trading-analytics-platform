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

- [x] T1 Verify `index.ts`, `app.ts` and the readiness controller, and decide the testable shape (a `createServer`/`shutdown` function that takes the signal source and a drain timeout, so tests do not send real signals). Findings and decisions are in the Log.
- [x] T2 The shutdown registry (`lifecycle/shutdown.ts`): ordered steps, idempotent trigger, `app.shutdown.started`/`completed`, tested with fake steps and an injected `exit`.
- [x] T3 Readiness 503 during shutdown (`status: "unavailable"`, no `checks`) through `createApp({ isShuttingDown })`, and its test.
- [ ] T4 The HTTP drain step with timeout, the Prisma close step, the signal wiring and the startup entries (`lifecycle/bootstrap.ts`, `index.ts`), tested with a real server on port 0, an injected timeout and exit: drain completes (0) and drain expires (1).
- [ ] T5 Reconcile `13`, `14`, `07` and ADR-006 for what landed.

## Done when

The shutdown sequence is tested for both exit codes and for the 503 on readiness; lifecycle entries appear in order.

## Risk

Items 4 (async ordering during shutdown) and 5 (process lifecycle, container signal handling).

## Verification

pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
- 2026-10-20: the user delegated the whole slice: Claude runs T1 to T5 one by one, commits after each, approves its own recommendations on the decisions that come up, and stops only for something delicate; then updates `pr-body.md` and hands over the PR commands.
- 2026-10-20: T1 findings (read-only). `index.ts` is `createApp()` plus `app.listen` with a `console.log`; it discards the server, handles no signal and never disconnects Prisma. `createApp(options)` is pure and per-call, so the shutdown flag cannot be module state. `healthRouter` is a constant router (`routes/health.ts`) used only by `app.ts`; `readinessHandler` calls `checkDatabaseConnection` and answers 503 with `checks` when the database fails. The shared client is `prisma` from `@trading/database` (`$disconnect` available). No `Dockerfile` exists yet (B7), so S4 only needs `index.ts` to stay the entrypoint.
- 2026-10-20: decisions (approved by Claude under the delegation, recommended option each time).
  - Shape: `lifecycle/shutdown.ts` holds `createShutdown({ logger, exit })` with `register(step)`, `isShuttingDown()` and `trigger(signal)`. A step is `{ name, run() }`. Steps run one after another in registration order, so B4 (jobs) and B5 (realtime, `1001`) register theirs before the HTTP step. No priority numbers.
  - `trigger` is idempotent (a second signal returns the same promise). It flips `isShuttingDown` first, so readiness answers 503 from the first instant, then logs `app.shutdown.started`, runs every step even if one fails (a failed step is logged and makes the exit code 1), logs `app.shutdown.completed` with `exitCode` and calls the injected `exit`.
  - Drain: the HTTP step calls `server.close()` and waits for it; after `drainTimeoutMs` (10 000, a constant passed in, not a new env variable) it calls `server.closeAllConnections()` and fails the step, which gives exit code 1. The Prisma step runs after it.
  - Readiness: `createApp({ isShuttingDown })` builds the health router with that function; while it is true, `/health/ready` answers 503 `{ status: "unavailable", service, timestamp }` with no `checks` and runs no database query. Liveness stays 200.
  - Levels: all four lifecycle entries at `info` (approved default 4, 2026-10-19), with `exitCode` (and `failedSteps` when any) on the completed entry. Startup: `app.startup.started` before `listen`, `app.startup.completed` in the listen callback with `port`.
  - Tests send no real signals: `bootstrap` takes the signal source, the `exit` function and the drain timeout.
