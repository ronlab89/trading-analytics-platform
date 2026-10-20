# B3.2 Request logging, correlation and slow requests

Source: roadmap B3 (`docs/BACKEND-ROADMAP.md`); ADR-009 points 2, 3, 5 and 8; `docs/13-observability-spec.md` §9, §17, §25, §26, §52, §53, §61. Depends on: B3.1. Branch: `feat/b3-2-request-logging`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

apps/api/src/**
apps/api/package.json
pnpm-lock.yaml
docs/13-observability-spec.md
docs/07-api-spec.md
docs/04-tech-stack.md
docs/PROGRESS.md

## Specs

- S1 A request-logger middleware writes one `http.request.completed` entry per request through the `Logger` port, with `method`, `status`, `durationMs` and `userId` once known; the route is the path without the query string, never the raw URL. It replaces `pino-http`, which writes to a pino instance directly and would bypass the port and the capturing logger; the user chose this on 2026-10-19 and ADR-009 point 2 was amended. (ADR-009 points 2 and 3; approved default 3, 2026-10-19)
- S2 The existing `requestId` propagates through `AsyncLocalStorage` to every log line of a request. (ADR-009 point 5)
- S3 `X-Request-ID` is exposed through CORS with `exposedHeaders`. (ADR-009 point 5)
- S4 `SLOW_REQUEST_THRESHOLD_MS` (default 500, validated in `env.ts`) applies to HTTP requests only; a slower request is its own `http.request.completed` entry raised to `warn`, not a separate event. (ADR-009 point 8; approved default 2)
- S5 Integration test: a request's `requestId` appears in all its log entries, using a capturing logger at `info`. (ADR-009 point 13 and Deferred detail)
- S6 `source`, `module`, `resourceType`, `resourceId` and `operationId` are not logged; Prisma query logging stays off. (ADR-009 point 3 and Deferred detail)

## Tasks

- [x] T1 `AsyncLocalStorage` request context fed by the `requestId` middleware, and the logger reading it. `logging/request-context.ts` (`runWithRequestContext`, `withRequestContext`); `attachLogger` wraps the logger with it; the explicit `requestId` that B3.1 passed by hand is gone.
- [x] T2 Request-logger middleware with `http.request.completed`, the path without query string and the slow-request `warn`; `SLOW_REQUEST_THRESHOLD_MS` in `env.ts`. `middleware/request-logger.ts`, wired in `createApp` after `attachLogger` (`AppOptions.slowRequestThresholdMs` overrides the env value for tests).
- [x] T3 CORS `exposedHeaders` and its test. `app.ts` exposes `X-Request-ID`; `app.cors.test.ts` (2 cases: allowed origin, foreign origin).
- [x] T4 Integration tests for correlation and the slow-request level. `app.logging.test.ts` (4 cases: header id on every entry of a 404, concurrent requests apart, `info` under the threshold, `warn` over it with a negative threshold so nothing sleeps).
- [x] T5 Reconcile the docs for what landed. `04-tech-stack.md` and `13-observability-spec.md`: `pino-http` removed, B3.2 marks flipped to `Implemented (B3.2)`; marks shared with B3.3/B3.4 stay `Planned (B3)`.

## Done when

Request correlation is verified from request to log; a slow request logs at `warn`; a browser can read `X-Request-ID`.

## Risk

Item 3 (CORS config others consume: additive `exposedHeaders`) and item 4 (`AsyncLocalStorage` async context).

## Verification

pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
- 2026-10-19: T1 done, pending the user's checks. Verified before building: with a throwaway script (not committed) on Express 5 and Node 24.16, the `AsyncLocalStorage` store survives `express.json()` for a valid body, a malformed body (the error handler still sees it) and an `await` in the handler, so no fallback is needed. Design: the logger decorator `withRequestContext` adds `requestId` to every entry written during a request and the context wins over a `requestId` in the fields; outside a request, entries pass through untouched (startup and shutdown). `request-id.ts` runs `next()` inside the context. B3.1's manual `requestId` in `logRequestFailure` and the readiness entry was removed (single source).
- 2026-10-19: review boundary resolved. The stop hook proposed a START with the stale base `d55fce2`; it was not run. Assess against `develop` (tree `278deb5`, checked with `git rev-parse develop^{tree}`) gave `high` (`hot_path`, signal security from the B3.3 task file; 33 files, 1586 lines, B3.1 plus B3.2 T1). Lenses `review-risk` and `review-reliability`. The user chose "Skip this time": the exact `declined` invocation ran once and returned `declined_this_candidate` for target `sha256:0ccbd95a…`. Resolved boundary: commit `da88f1d`. Later assessments use `--base-ref da88f1d`.
- 2026-10-19: the user chose option A for request logs (own middleware through the `Logger` port, no `pino-http`). ADR-009 point 2 and its negative consequences were amended; `04-tech-stack.md` and `13-observability-spec.md` still name `pino-http` and are fixed in T5.
- 2026-10-19: T3, T4 and T5 done, pending the user's checks. T5 left `pino-http` in `14-deployment-spec.md` §(CI line 1970), `15-implementation-plan.md` (lines 421 and 1165) and `BACKEND-ROADMAP.md` (line 390), which are outside this slice's edit surfaces; B3.5 (docs close) fixes them. The "today" baseline columns of `13` that describe the pre-B3 state (for example "Request logs do not exist") were kept on purpose.
- 2026-10-19: T2 done, pending the user's checks. The entry is written on `finish`, restoring the request context by hand because the event fires from the socket; a request the client abandons leaves no entry. Duration is `Math.round` of a monotonic clock (`performance.now`, injectable). `durationMs > threshold` is `warn`, equal stays `info`. Every request is logged, `/health` included; if the probes of the `full` profile (B7) make that noisy, give them `debug` then. Tests: `request-logger.test.ts` (8), `env.test.ts` (+2 cases groups), and `health.unavailable.routes.test.ts` now filters by event because every request adds an entry. `error-handler.test.ts` now runs the handler inside a context. New tests: `request-context.test.ts` (6) and `request-id.test.ts` (5, including a POST with body and two concurrent requests).
