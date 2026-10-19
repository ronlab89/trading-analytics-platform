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
- [x] T2 Add `pino` and `pino-pretty`, the adapter, `LOG_LEVEL` in `env.ts` and the redaction list, with one unit test per redacted case and the event-name convention test. `apps/api/src/logging/` holds `pino-logger.ts` (adapter and `REDACTED_PATHS`), `events.ts` (`LOG_EVENTS`) and their tests; `env.ts` resolves `LOG_LEVEL` from `NODE_ENV` in a schema transform.
- [x] T3 Replace the `console.*` sites; log by category in the error handler; rename to `http.request.failed`; error handler tests (4xx and 5xx paths, no stack in the response). The `index.ts` startup line is left for B3.4 (`app.startup.*`).
- [x] T4 Reconcile `13-observability-spec.md` and `04-tech-stack.md` for what landed.

## Done when

No `console.*` remains in the API request path; sensitive fields never reach a log (tested); the error handler logs every category at its level.

## Risk

Item 5 (dependencies: `pino`, `pino-pretty`) and item 2 (credentials must not leak: redaction).

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19 (the 8 open details of `13-observability-spec.md` approved in one batch).
- 2026-10-19: T1 done. Findings that shape T2 and T3: (a) the `console.*` sites are `env.ts` (2 lines, kept), `error-handler.ts` (`logRequestFailed`, called for dependency and unexpected errors), `health.controller.ts` (readiness) and `index.ts` (startup line, replaced in B3.4); (b) `DEPENDENCY_ERROR` already maps to 503 (B0), so only its log level is new; (c) handled errors (`AppError`, application errors, body-parser, domain `Invalid*`) are not logged today and must be, by category; (d) the rate limiters answer 429 themselves without reaching the handler, so `RATE_LIMITED` at `warn` is logged in `rate-limit.ts`, not in the handler; (e) the port takes `message` as an optional field and the adapter derives it from `event` (S1).
- 2026-10-19: T2 done, pending the user's `pnpm install` and checks. Versions: `pino` ^10.4.0 (dependency), `pino-pretty` ^13.2.0 (devDependency, development only). Redaction is by field name (`password`, `authorization`, `cookie`, `accessToken`, `refreshToken`, `token`, `input`, their one-level nested forms, `*.headers.authorization`, `*.headers.cookie`, `*.headers["set-cookie"]`); the WebSocket message shape is not defined until B5, so `token` and `*.token` cover it by name and B5 re-checks the path against its real message. The `pretty` branch (transport) has no unit test: it spawns a worker and writes to the terminal; it is checked by running `pnpm dev` at T3.
- 2026-10-19: T3 done, pending the user's checks. Design: `middleware/attach-logger.ts` sets `req.logger` (same pattern as `req.requestId`); `createApp({ logger })` takes it, defaulting to `logging/logger.ts` (pino, level from `LOG_LEVEL`); `logging/request-failure.ts` holds `logRequestFailure` and a `Record<ErrorCode, level>` (exhaustive, so a new code cannot ship without a level), used by the error handler and by `rateLimitHandler`. Decision taken here, not in the ADR: every error category is the same event, `http.request.failed`, with `errorCategory` and the level by code; only `error`-level entries carry the raw message, `errorName` and `stack`, the others carry the message the client received. `requestId` is still passed by hand; B3.2 moves it to `AsyncLocalStorage`. Tests rewritten to inject a capturing logger: `error-handler.test.ts` (13 levels, stack, no leak in the response), `rate-limit.test.ts`, `health.unavailable.routes.test.ts`, `positions.routes.test.ts`.
- 2026-10-19: lint failed on `request-failure.ts` (`no-base-to-string` on `String(cause)`); fixed by logging a string cause as is and any other non-Error cause as the client message. After that fix the application (262), API (586) tests, typecheck and lint passed.
- 2026-10-19: T4 done, pending `pnpm docs:check`. `04-tech-stack.md` §42-44 and the dependency table, and `13-observability-spec.md` §1-2, 4-6, 8, 11-13, 21, 23, 38, 57-60, 68, 69, 74-75 now say what B3.1 delivered (the logger, redaction, `LOG_LEVEL`, error logging by category). Marks owned by B3.2 to B3.4 (request logs, `requestId` on every line, CORS header, slow request, security events, startup and shutdown) stay `Planned (B3)`; B3.5 sweeps the rest. The 13 §12 table was also stale on B0 (dependency errors, application errors) and was corrected. Not touched: `07-api-spec.md`, `09-security-spec.md`, `14-deployment-spec.md`.
