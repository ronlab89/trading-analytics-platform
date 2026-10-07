# ADR-009: Observability Scope — Structured, Correlated, Safe Logging

**Status:** Accepted
**Date:** 2026-10-04
**Amended:** 2026-10-07 (points 2-13, approved by the user from the
`13-observability-spec.md` reconciliation; point 11 startup entries,
approved by the user from the `14-deployment-spec.md` reconciliation)
**Implemented in:** roadmap block B3 (not yet implemented); `auth.logout`
lands with its endpoint in B2 and the simulator entries in B5

## Context

The API logs with `console.log`; there is no logger module and no logging
dependency. `13-observability-spec.md` asks for much more than a local
deployment can use: Prometheus-style HTTP, application, realtime and job
metrics, a `/metrics` endpoint, process metrics (§17-20, §49-50) and log
rotation (§47). Its final checklist (§74) mixes backend, frontend and demo
items, so the backend block can never be closed against it.

Under ADR-006 the backend runs locally only. Nothing would consume metrics.
What the project does need is the ability to diagnose failures, especially
in asynchronous work (realtime, ADR-007; jobs, ADR-008), and an audit trail
for security events (`09-security-spec.md` §50).

This ADR concerns operational logs read by the developer. User-visible
activity (the Activity view, notifications) is a product feature and is out
of its scope.

## Decision

1. **Port.** A `Logger` interface in `@trading/application`. The API
   provides a pino-based adapter; the demo provides a browser-console
   adapter. Application code logs without knowing where it runs (ADR-001).
2. **Library.** `pino` for structured JSON logs, `pino-http` for request
   logs, `pino-pretty` in development only. (Amended 2026-10-07: the three
   choices are reconfirmed.)
   - **Source of the packages.** They come from the lockfile. CI adds no
     dependency audit or license step for them in v1 (NFR-070).
   - **Format by environment.** The format follows the environment: JSON on
     stdout, and `pino-pretty` only in development. `LOG_FORMAT`,
     `ENABLE_DEBUG_LOGGING` and `ENABLE_DEV_DIAGNOSTICS` are not adopted;
     `LOG_LEVEL=debug` (point 7) covers debug output.
3. **Format.** One JSON line per event on stdout, with `timestamp`, `level`,
   `service`, `environment`, `event`, `message`, `requestId`, `userId`
   (identifier only), `durationMs` and `errorCategory` where relevant.
   `event` is a stable dotted name such as `http.request.completed` or
   `job.failed`. No log files and no rotation; `13-observability-spec.md`
   §47 is removed. (Amended 2026-10-07:)
   - **Error fields.** `errorCategory` carries the `AppErrorCode` wire value
     (ADR-002 point 10). `errorName` appears only on the unexpected-error
     line (point 6), next to the stack.
   - **Added and not adopted.** `service`, `environment` and `message` are
     added. `source`, `module`, `resourceType`, `resourceId` and
     `operationId` are not adopted in v1 (Deferred detail).
4. **Redaction.** A fixed list of fields is never logged: passwords, the
   `Authorization` header, cookies, access tokens and refresh tokens.
   Enforced by tests. (Amended 2026-10-07: redaction covers only these named
   fields. The `message` of an unexpected error is logged unfiltered in v1
   because logs go to local stdout. Hosting the backend (point 10) reopens
   this.)
5. **Correlation.** The existing `requestId` propagates through
   `AsyncLocalStorage` to every log line of a request. Jobs carry `jobId`;
   realtime connections carry `connectionId`. (Amended 2026-10-07: the
   `X-Request-ID` response header is exposed through CORS
   (`exposedHeaders`). `Planned (B3)`.)
6. **Error classification.** The error handler logs by category:
   validation and authentication failures at `warn`, not-found and conflict
   at `info`, internal errors at `error` with the stack trace. (Amended
   2026-10-07:)
   - **Levels by code.** `FORBIDDEN` and `RATE_LIMITED` log at `warn`.
     `DEPENDENCY_ERROR` logs at `error` with the stack.
   - **Event names.** The unexpected-error line is named
     `http.request.failed` (today `request.failed`). The readiness failure
     line keeps the name `health.database.unavailable`.
7. **Levels.** Controlled by `LOG_LEVEL`: `debug` in development, `info` in
   production, `silent` in tests. (Amended 2026-10-07: `LOG_LEVEL` is the
   only logging-format or verbosity variable; see point 2.)
8. **Slow operations.** A `warn` entry when a request exceeds a configurable
   threshold (default 500 ms). Reconstruction of the analytics series
   (ADR-004) is timed separately. (Amended 2026-10-07:)
   - **Threshold variable.** `SLOW_REQUEST_THRESHOLD_MS`, default 500, for
     HTTP requests only.
   - **No other timing.** Requests and the analytics series reconstruction
     are the only timing in v1. Individual database operations are not
     timed, and Prisma query logging is not enabled (Deferred detail).
9. **Security events.** `auth.login.succeeded`, `auth.login.failed`,
   `auth.refresh.reuse_detected`, `authz.denied`. (Amended 2026-10-07:)
   - **Logout.** `auth.logout` is added at `info`, with `userId` only.
     `Planned (B2)`, with the endpoint.
   - **Refresh failures.** A refresh failure other than reuse (an expired,
     unknown or revoked token, or a missing custom header) has no dedicated
     event. It stays an ordinary 401 request log.
10. **Metrics.** `Deferred`. No `/metrics` endpoint and no metrics library
    until something consumes them (NFR-070). Health and readiness endpoints
    already exist. Hosting the backend later (ADR-006 point 2) reopens this
    and the message filtering of point 4.
11. **Lifecycle events.** Startup, graceful shutdown (ADR-006 point 12), job
    transitions (ADR-008) and realtime connection events (ADR-007).
    (Amended 2026-10-07:)
    - **Shutdown.** The shutdown logs `app.shutdown.started` and
      `app.shutdown.completed`. `Planned (B3)`.
    - **Startup.** (Added 2026-10-07, approved by the user from the
      `14-deployment-spec.md` reconciliation, §52.) The startup logs
      `app.startup.started` and `app.startup.completed`, mirroring the
      shutdown pair. `Planned (B3)`.
    - **Simulator.** `simulation.started`, `simulation.paused` and
      `simulation.mode.changed`; the names follow the endpoints (ADR-007
      point 15). `Planned (B5)`. There is no `simulation.resumed`, because
      `start` from `HALTED` is the resume, and no `simulation.stopped`,
      because real mode has no stop (ADR-007 point 15). `simulation.error`
      is deferred because no ADR defines simulator errors.
    - **No recovery entry.** v1 has no database recovery entry and no
      `dependency.recovered`, because there is one dependency (Deferred
      detail).
12. **Scope of B3.** Backend only. The checklist in
    `13-observability-spec.md` §74 is split into backend (B3), frontend and
    demo (frontend phase) checklists. (Amended 2026-10-07: a development
    realtime debug mode or diagnostics panel is deferred to the
    frontend-stage ADR, and a demo diagnostics interface to the demo ADR
    (ADR-010 point 6).)
13. **Tests.** Unit tests for redaction and event names; integration tests
    verifying that a request's `requestId` appears in its log entries.
    (Amended 2026-10-07: the health route test (`GET /health` and
    `GET /health/ready`) is part of the B0 route tests, ADR-001 point 8.)

## Consequences

**Positive**

- Any failure reported with a `requestId` can be traced through the server.
- Asynchronous work is diagnosable.
- Security-relevant events leave an audit trail without leaking secrets.
- B3 has a closable scope.

**Negative**

- New dependencies (`pino`, `pino-http`, `pino-pretty`).
- Every new feature must define its event names.
- No quantitative metrics until a consumer exists.

**Documents to align**

- `13-observability-spec.md` (scope, metrics deferred, checklist split,
  the 2026-10-07 decisions).
- `04-tech-stack.md` (logging library, fields, slow-request variable).
- `09-security-spec.md` §50 (event names, `auth.logout`).
- `14-deployment-spec.md` §16 (graceful shutdown, ADR-006 point 12).

## Alternatives Considered

- **Keep `console.log`.** Unstructured, uncorrelated and unsafe with
  sensitive data. Rejected.
- **In-memory metrics with a custom `/metrics` endpoint.** Demonstrable but
  unread in a local environment. Deferred.
- **Full metrics stack (Prometheus and Grafana).** Infrastructure without a
  deployment that needs it. Rejected.
- **Winston.** Slower and with weaker structured-logging defaults than pino
  for this use. Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| Redaction by header name misses `Set-Cookie` on responses, the access token inside the WebSocket authentication message, and the stored CSV input. | Redaction paths cover the response `set-cookie` header and the WebSocket token. Job input is never logged. Each case has a test. | B3 |
| `LOG_LEVEL=silent` in tests contradicts the integration test that asserts `requestId` in log entries. | Those tests inject a capturing logger at `info`; `silent` remains the default elsewhere. | B3 |
| The fields `source`, `module`, `resourceType`, `resourceId` and `operationId` are not adopted (point 3). | Not logged in v1. `requestId`, `jobId` and `connectionId` are the correlation fields (point 5). | B3 |
| Individual database operations are not timed and Prisma query logging is off (point 8). | Only requests and the analytics series reconstruction are timed in v1. | B3 |
| A database recovery entry (and `dependency.recovered`) needs a poller, because readiness is stateless: `GET /health/ready` runs `SELECT 1` per request (point 11). | No entry in v1. Reconsidered when the API healthcheck exists. | B7 |
| `simulation.error` has no defined trigger, because no ADR defines simulator errors (point 11). | Not logged in v1. Named when the simulator errors are defined. | B5 |

## Related

- ADR-001 (point 8, health route test), ADR-002 (point 10, error codes),
  ADR-005, ADR-006 (point 12, graceful shutdown), ADR-007, ADR-008
- ADR-010 point 6 (frontend-stage and demo ADR)
- `13-observability-spec.md`, `09-security-spec.md` §50
