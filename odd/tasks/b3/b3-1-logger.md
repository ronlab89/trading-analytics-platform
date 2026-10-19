# B3.1 Logger port, pino adapter and redaction

Source: roadmap B3 (`docs/BACKEND-ROADMAP.md`); ADR-009 points 1 to 4, 6 and 7; `docs/13-observability-spec.md` §6, §7, §11, §12, §38, §68. Depends on: B2. Branch: `feat/b3-1-logger`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/application/src/**
apps/api/src/**
apps/api/package.json
pnpm-lock.yaml
docs/13-observability-spec.md
docs/04-tech-stack.md
docs/PROGRESS.md

## Specs

- S1 A `Logger` port in `@trading/application` with a `pino` adapter in the API. Signature: `debug|info|warn|error(event, fields?)`; the `message` is built from the `event` unless the caller passes one. (ADR-009 point 1; approved default 1, 2026-10-19)
- S2 One JSON line per event on stdout with `timestamp`, `level`, `service`, `environment`, `event`, `message` and, where relevant, `requestId`, `userId`, `durationMs`, `errorCategory`. No log files, no rotation. (ADR-009 point 3)
- S3 `pino-pretty` in development only; `LOG_FORMAT`, `ENABLE_DEBUG_LOGGING` and `ENABLE_DEV_DIAGNOSTICS` are not adopted. (ADR-009 point 2)
- S4 `LOG_LEVEL` is validated in `env.ts` with zod; when absent its default follows `NODE_ENV`: `debug` in development, `info` in production, `silent` in tests. (ADR-009 point 7; approved default 5)
- S5 Redaction of passwords, the `Authorization` header, cookies, access tokens, refresh tokens, the response `set-cookie` header and the access token inside the WebSocket authentication message; job input is never logged. Each case has a test. (ADR-009 point 4 and Deferred detail)
- S6 The error handler logs by category: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN` and `RATE_LIMITED` at `warn`; `NOT_FOUND` and `CONFLICT` at `info`; `DEPENDENCY_ERROR` and `INTERNAL_ERROR` at `error` with the stack. `errorCategory` carries the `AppErrorCode` wire value; `errorName` appears only on the unexpected-error line. (ADR-009 points 3 and 6)
- S7 The unexpected-error line is named `http.request.failed` (today `request.failed`); the readiness failure line keeps `health.database.unavailable`. (ADR-009 point 6)
- S8 Every `console.*` in `apps/api/src` goes through the logger, except the invalid-environment keys in `env.ts`, which run before the logger exists. (ADR-009 point 1; approved by default, to confirm at T3)
- S9 Tests that assert log content inject a capturing logger at `info`; `silent` stays the default elsewhere. Error handler tests are part of B3. (ADR-009 Deferred detail; approved default 8)

## Tasks

- [x] T1 Re-verify the starting point (the 4 `console.*` sites, `env.ts`, the error handler) and add the `Logger` port plus a capturing test logger. Port in `packages/application/src/logger.ts` (`Logger`, `LogFields`, `capturingLogger`, `silentLogger`), tests in `logger.test.ts`, exported from `index.ts`.
- [ ] T2 Add `pino` and `pino-pretty`, the adapter, `LOG_LEVEL` in `env.ts` and the redaction list, with one unit test per redacted case and the event-name convention test.
- [ ] T3 Replace the `console.*` sites; log by category in the error handler; rename to `http.request.failed`; error handler tests (200, 4xx and 500 paths, no stack in the response).
- [ ] T4 Reconcile `13-observability-spec.md` and `04-tech-stack.md` for what landed.

## Done when

No `console.*` remains in the API request path; sensitive fields never reach a log (tested); the error handler logs every category at its level.

## Risk

Item 5 (dependencies: `pino`, `pino-pretty`) and item 2 (credentials must not leak: redaction).

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19 (the 8 open details of `13-observability-spec.md` approved in one batch).
- 2026-10-19: T1 done. Findings that shape T2 and T3: (a) the `console.*` sites are `env.ts` (2 lines, kept), `error-handler.ts` (`logRequestFailed`, called for dependency and unexpected errors), `health.controller.ts` (readiness) and `index.ts` (startup line, replaced in B3.4); (b) `DEPENDENCY_ERROR` already maps to 503 (B0), so only its log level is new; (c) handled errors (`AppError`, application errors, body-parser, domain `Invalid*`) are not logged today and must be, by category; (d) the rate limiters answer 429 themselves without reaching the handler, so `RATE_LIMITED` at `warn` is logged in `rate-limit.ts`, not in the handler; (e) the port takes `message` as an optional field and the adapter derives it from `event` (S1).
