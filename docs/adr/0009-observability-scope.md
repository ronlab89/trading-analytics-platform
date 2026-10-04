# ADR-009: Observability Scope — Structured, Correlated, Safe Logging

**Status:** Accepted
**Date:** 2026-10-04
**Implemented in:** roadmap block B3 (not yet implemented)

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
   logs, `pino-pretty` in development only.
3. **Format.** One JSON line per event on stdout, with `timestamp`, `level`,
   `event`, `requestId`, `userId` (identifier only), `durationMs` and
   `errorCategory` where relevant. `event` is a stable dotted name such as
   `http.request.completed` or `job.failed`. No log files and no rotation;
   `13-observability-spec.md` §47 is removed.
4. **Redaction.** A fixed list of fields is never logged: passwords, the
   `Authorization` header, cookies, access tokens and refresh tokens.
   Enforced by tests.
5. **Correlation.** The existing `requestId` propagates through
   `AsyncLocalStorage` to every log line of a request. Jobs carry `jobId`;
   realtime connections carry `connectionId`.
6. **Error classification.** The error handler logs by category:
   validation and authentication failures at `warn`, not-found and conflict
   at `info`, internal errors at `error` with the stack trace.
7. **Levels.** Controlled by `LOG_LEVEL`: `debug` in development, `info` in
   production, `silent` in tests.
8. **Slow operations.** A `warn` entry when a request exceeds a configurable
   threshold (default 500 ms). Reconstruction of the analytics series
   (ADR-004) is timed separately.
9. **Security events.** `auth.login.succeeded`, `auth.login.failed`,
   `auth.refresh.reuse_detected`, `authz.denied`.
10. **Metrics.** `Deferred`. No `/metrics` endpoint and no metrics library
    until something consumes them (NFR-070). Health and readiness endpoints
    already exist. Hosting the backend later (ADR-006 point 2) reopens this.
11. **Lifecycle events.** Startup, graceful shutdown (ADR-006), job
    transitions (ADR-008) and realtime connection events (ADR-007).
12. **Scope of B3.** Backend only. The checklist in
    `13-observability-spec.md` §74 is split into backend (B3), frontend and
    demo (frontend phase) checklists.
13. **Tests.** Unit tests for redaction and event names; integration tests
    verifying that a request's `requestId` appears in its log entries.

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

- `13-observability-spec.md` (scope, metrics deferred, checklist split).
- `04-tech-stack.md` (logging library).
- `09-security-spec.md` §50 (event names).

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

## Related

- ADR-001, ADR-005, ADR-006, ADR-007, ADR-008
- `13-observability-spec.md`, `09-security-spec.md` §50
