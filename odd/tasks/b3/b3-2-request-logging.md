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

- S1 `pino-http` writes one `http.request.completed` entry per request with `method`, `status` and `durationMs`; the route is the path without the query string, never the raw URL. (ADR-009 points 2 and 3; approved default 3, 2026-10-19)
- S2 The existing `requestId` propagates through `AsyncLocalStorage` to every log line of a request. (ADR-009 point 5)
- S3 `X-Request-ID` is exposed through CORS with `exposedHeaders`. (ADR-009 point 5)
- S4 `SLOW_REQUEST_THRESHOLD_MS` (default 500, validated in `env.ts`) applies to HTTP requests only; a slower request is its own `http.request.completed` entry raised to `warn`, not a separate event. (ADR-009 point 8; approved default 2)
- S5 Integration test: a request's `requestId` appears in all its log entries, using a capturing logger at `info`. (ADR-009 point 13 and Deferred detail)
- S6 `source`, `module`, `resourceType`, `resourceId` and `operationId` are not logged; Prisma query logging stays off. (ADR-009 point 3 and Deferred detail)

## Tasks

- [x] T1 `AsyncLocalStorage` request context fed by the `requestId` middleware, and the logger reading it. `logging/request-context.ts` (`runWithRequestContext`, `withRequestContext`); `attachLogger` wraps the logger with it; the explicit `requestId` that B3.1 passed by hand is gone.
- [ ] T2 `pino-http` with `http.request.completed`, the path without query string and the slow-request `warn`; `SLOW_REQUEST_THRESHOLD_MS` in `env.ts`.
- [ ] T3 CORS `exposedHeaders` and its test.
- [ ] T4 Integration tests for correlation and the slow-request level (the threshold read from config, no real sleeps beyond what the `Clock` or a tiny threshold allows).
- [ ] T5 Reconcile the docs for what landed.

## Done when

Request correlation is verified from request to log; a slow request logs at `warn`; a browser can read `X-Request-ID`.

## Risk

Item 3 (CORS config others consume: additive `exposedHeaders`) and item 4 (`AsyncLocalStorage` async context).

## Verification

pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
- 2026-10-19: T1 done, pending the user's checks. Verified before building: with a throwaway script (not committed) on Express 5 and Node 24.16, the `AsyncLocalStorage` store survives `express.json()` for a valid body, a malformed body (the error handler still sees it) and an `await` in the handler, so no fallback is needed. Design: the logger decorator `withRequestContext` adds `requestId` to every entry written during a request and the context wins over a `requestId` in the fields; outside a request, entries pass through untouched (startup and shutdown). `request-id.ts` runs `next()` inside the context. B3.1's manual `requestId` in `logRequestFailure` and the readiness entry was removed (single source). `error-handler.test.ts` now runs the handler inside a context. New tests: `request-context.test.ts` (6) and `request-id.test.ts` (5, including a POST with body and two concurrent requests).
