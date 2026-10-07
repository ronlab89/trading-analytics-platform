# SDD 13 — Observability Specification

**Project:** Trading Analytics Platform  
**Document:** Observability Specification  
**Version:** 1.0  
**Status:** Specification  
**Previous document:** `12-demo-mode-spec.md`  
**Next document:** `14-deployment-spec.md`

---

## 1. Purpose

**Status:** `Reference`

This document defines the observability strategy for the Trading Analytics Platform.

The objective is to make the system understandable while it is running: developers should be able to identify what happened, where it happened, why it happened, and how the system recovered.

Observability is treated as part of the architecture rather than as an operational afterthought.

The system must provide useful visibility into:

- application behavior
- HTTP requests and responses
- errors and failures
- authentication and authorization events
- database interactions
- background processes
- realtime connections and events
- simulated demo behavior
- performance characteristics
- service health
- development and debugging workflows

The implementation must work locally and must not require a paid observability platform.

Each section carries a status (see [`README.md`](README.md#status-legend)). ADR-009 sets the scope: structured, correlated and safe backend logging in block B3, metrics `Deferred`, and the frontend and demo parts in the frontend stage (`Planned (FE)`). Under ADR-006 the backend runs locally only, so nothing in this document assumes a hosted service.

Today the API has no logger module and no logging dependency. It writes three kinds of lines with `console`:

| Where | Output |
| --- | --- |
| `apps/api/src/middleware/error-handler.ts` | One JSON line per unexpected error: `level`, `event: "request.failed"`, `requestId`, `errorName`, `message` |
| `apps/api/src/controllers/health.controller.ts` | One JSON line when readiness fails: `level`, `event: "health.database.unavailable"`, `requestId`, `errorName` |
| `apps/api/src/index.ts`, `apps/api/src/config/env.ts` | Plain text: the startup line, and the names of invalid environment keys (never their values) |

The `Logger` port, `pino` and request logs replace these in B3 (ADR-009 points 1-2).

---

## 2. Observability Goals

**Status:** `Reference`

The observability layer should answer five practical questions.

### 2.1 What happened?

Logs and structured events must provide enough context to reconstruct important application behavior.

### 2.2 Where did it happen?

Request IDs, operation IDs, module names and relevant entity identifiers must allow an event to be traced to its source.

### 2.3 Why did it happen?

Errors must contain actionable context without exposing sensitive information.

### 2.4 Is the system healthy?

Health endpoints and runtime metrics must provide a quick indication of application and dependency health.

### 2.5 Is the system behaving as expected?

Performance measurements and domain-level metrics should reveal abnormal behavior without requiring an external monitoring service.

How each question is answered in version 1:

| Question | Mechanism | Status |
| --- | --- | --- |
| 2.1 What happened? | Structured JSON log events (§6-8) | `Planned (B3)` |
| 2.2 Where did it happen? | `requestId` on responses and error bodies | `Implemented` |
| | `requestId` on every log line of a request; `jobId`, `connectionId` (§9-10) | `Planned (B3)` (ADR-009 point 5) |
| 2.3 Why did it happen? | Central error handler with safe responses (§12) | `Implemented` |
| | Logging by error category, with the stack for internal errors | `Planned (B3)` (ADR-009 point 6) |
| 2.4 Is the system healthy? | `GET /health` and `GET /health/ready` | `Implemented` |
| | Runtime metrics | `Deferred` (ADR-009 point 10) |
| 2.5 Is the system behaving as expected? | Slow-request warnings and timed series reconstruction | `Planned (B3)` (ADR-009 point 8) |
| | Performance and domain-level metrics | `Deferred` (ADR-009 point 10) |

---

## 3. Observability Principles

**Status:** `Reference`

The implementation follows these principles:

1. **Structured over unstructured**
2. **Correlation over isolated events**
3. **Actionable over verbose**
4. **Safe over convenient**
5. **Local-first**
6. **Provider-agnostic**
7. **Low overhead**
8. **Debuggable by default**
9. **Business context without business-sensitive data**
10. **No invented measurements**

The observability system should help explain the software without becoming another source of complexity.

---

# 4. Observability Architecture

**Status:** API request ID and error handling `Implemented`; `Logger` port and request logs `Planned (B3)` (ADR-009 points 1-2); frontend `Planned (FE)`; metrics `Deferred` (ADR-009 point 10)

Observability is distributed across the application layers.

```text
                    ┌─────────────────────┐
                    │      Frontend       │
                    │                     │
                    │ UI / Query / State  │
                    │ Realtime / Errors   │
                    └──────────┬──────────┘
                               │
                         HTTP / WebSocket
                               │
                    ┌──────────▼──────────┐
                    │       API Layer     │
                    │                     │
                    │ Request ID           │
                    │ Access logs          │
                    │ Error handling       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Application/Domain  │
                    │                     │
                    │ Business events     │
                    │ Performance timing  │
                    │ Background jobs      │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
       │ PostgreSQL  │ │ WebSocket   │ │ External /  │
       │             │ │             │ │ Mock infra  │
       │ DB health   │ │ Connection  │ │ failures     │
       └─────────────┘ └─────────────┘ └─────────────┘

                         Observability
                              │
              ┌───────────────┼────────────────┐
              │               │                │
           Logs            Metrics          Health
              │               │                │
              └───────────────┼────────────────┘
                              │
                     Local developer tools
```

The architecture must keep observability concerns separate from domain logic.

Domain code may emit meaningful domain events or measurements through an abstraction, but it should not depend directly on a specific logging vendor.

Code vs ADR:

- The abstraction is the `Logger` interface in `@trading/application` (ADR-009 point 1). The API supplies a `pino` adapter and the demo a browser-console adapter, so application code logs without knowing where it runs. `@trading/application` itself does not exist yet; it is created in B0 (ADR-001 point 1), and the port is added in B3.
- `@trading/domain` has no logging today and no ADR gives it a logger: it returns values or throws errors, and the application layer decides what to log (ADR-001).
- The "Application/Domain" box assumes application services. Today services in `apps/api/src/services` call Prisma repositories directly (ADR-001 moves them in B0).
- The "Background jobs" box is the in-process job runner of ADR-008 (`Planned (B4)`). The "WebSocket" box is the realtime server of ADR-007 (`Planned (B5)`).
- "External / Mock infra" has no server-side counterpart: the API calls no external service. Mock infrastructure is the demo (`Planned (FE)`, ADR-010 point 6).
- The "Metrics" branch is `Deferred` (ADR-009 point 10). Version 1 has logs and health checks only.

---

# 5. Observability Components

**Status:** per capability (table below)

The system will expose four primary observability capabilities:

| Capability | Purpose | Status |
|---|---|---|
| Logging | Understand events and execution flow | `Planned (B3)` (ADR-009 points 1-3); `console` lines today (§1) |
| Error tracking | Identify and investigate failures | Central error handler `Implemented`; category logging `Planned (B3)` (ADR-009 point 6) |
| Metrics | Measure runtime behavior | `Deferred` (ADR-009 point 10) |
| Health checks | Determine service/dependency availability | `Implemented` (`apps/api/src/routes/health.ts`) |

Performance instrumentation is considered part of metrics and diagnostic tooling.

Error tracking means the error handler plus logs. There is no error-tracking service; under ADR-006 nothing is hosted. Version 1 performance instrumentation is limited to the slow-request warning and the timed series reconstruction of ADR-009 point 8, both written as log entries.

---

# 6. Logging Strategy

**Status:** `Planned (B3)` (ADR-009 points 2-3 and 7); two JSON `console` lines exist today (§1)

## 6.1 General Requirements

Application logs must be structured.

JSON should be the preferred format for backend logs because structured fields can be filtered, searched and aggregated easily.

Development output may use a human-readable formatter when this improves local debugging, provided the underlying log event remains structured.

Example conceptual event:

```json
{
  "level": "info",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "service": "trading-api",
  "environment": "development",
  "event": "portfolio.updated",
  "requestId": "req_123",
  "userId": "user_123",
  "portfolioId": "portfolio_456",
  "durationMs": 18
}
```

The library is decided: `pino` for structured JSON logs, `pino-http` for request logs and `pino-pretty` in development only (ADR-009 point 2). Each event is one JSON line on stdout; there are no log files (ADR-009 point 3).

Code vs ADR:

- None of the three packages is a dependency yet. The two JSON lines written today (§1) already carry `level`, `event` and `requestId`, but no `timestamp`, and they go to stderr through `console.error`.
- The example above shows `service`, `environment` and `portfolioId`, which ADR-009 point 3 does not list. See §7 for the field set.
- `portfolio.updated` is illustrative. ADR-009 names no per-resource domain events; each feature defines its own event names (ADR-009, Consequences).

---

## 6.2 Log Levels

The system should support conventional log levels:

### ERROR

Unexpected failures requiring investigation.

Examples:

- unhandled application error
- database failure
- background job failure
- realtime processing failure
- unexpected infrastructure exception

### WARN

Abnormal but recoverable conditions.

Examples:

- retry triggered
- reconnect initiated
- request exceeded expected diagnostic threshold
- simulated failure activated
- dependency temporarily unavailable

### INFO

Important application lifecycle and domain-level events.

Examples:

- server started
- authenticated session established
- background job completed
- websocket connected
- websocket disconnected
- demo scenario started

### DEBUG

Detailed diagnostic information intended primarily for development.

Examples:

- repository operation
- state synchronization
- query parameters after sanitization
- realtime subscription lifecycle

### TRACE

Optional highly detailed diagnostics.

This level should generally be disabled outside focused debugging sessions.

Decided levels:

The active level comes from `LOG_LEVEL`: `debug` in development, `info` in production and `silent` in tests (ADR-009 point 7). Integration tests that assert log content inject a capturing logger at `info` instead (ADR-009, Deferred detail). `LOG_LEVEL` is not in `apps/api/src/config/env.ts` yet; it is added in B3.

The error handler logs by category (ADR-009 point 6):

| Error | Level |
| --- | --- |
| Validation failure (`VALIDATION_ERROR`) | `warn` |
| Authentication failure (`UNAUTHORIZED`) | `warn` |
| Not found (`NOT_FOUND`), conflict (`CONFLICT`) | `info` |
| Internal error (`INTERNAL_ERROR`) | `error`, with the stack trace |

A request slower than the configured threshold (default 500 ms) is a `warn` entry (ADR-009 point 8).

Code vs ADR:

- Today only unexpected errors and readiness failures are logged, both at `error` and without the stack trace. Handled errors are not logged.
- ADR-009 point 6 does not assign a level to `FORBIDDEN`, `RATE_LIMITED` or `DEPENDENCY_ERROR`. Open detail (B3).
- `TRACE` is not part of the decided levels. `pino` supports it, but no configuration uses it.
- Some examples above belong to later stages. Retries: the job runner retries only on request (ADR-008 point 6, B4); HTTP client retries are decided in the frontend-stage ADR (ADR-006 point 11). Simulated failures and demo scenarios are demo features (`Planned (FE)`, ADR-010 point 6) and log through the browser-console adapter (ADR-009 point 1). WebSocket events are `Planned (B5)`; their per-event level is an open detail of `08-realtime-spec.md` §58.

---

# 7. Structured Log Schema

**Status:** `Planned (B3)` (ADR-009 points 3 and 5)

A common base schema should be used whenever possible.

Recommended fields:

| Field | Purpose |
|---|---|
| `timestamp` | Event time |
| `level` | Severity |
| `service` | Application/service name |
| `environment` | Runtime environment |
| `event` | Stable event identifier |
| `message` | Human-readable description |
| `requestId` | HTTP correlation identifier |
| `operationId` | Logical operation identifier |
| `userId` | Internal user identifier when appropriate |
| `resourceType` | Domain resource type |
| `resourceId` | Relevant resource identifier |
| `durationMs` | Operation duration when applicable |
| `errorCode` | Application error code |
| `errorName` | Error classification |
| `source` | Layer/module that emitted the event |

Not every log event requires every field.

Code vs ADR:

- ADR-009 point 3 decides `timestamp`, `level`, `event`, `requestId`, `userId` (identifier only), `durationMs` and `errorCategory` where relevant. Point 5 adds `jobId` for jobs and `connectionId` for realtime connections; neither is in the table above.
- ADR-009 names one error field, `errorCategory`; the table has `errorCode` and `errorName`. Today's lines write `errorName` (§1). Whether `errorCategory` holds the `AppErrorCode` value (§12.2) and whether `errorName` is kept is an open detail (B3).
- `service`, `environment`, `message`, `operationId`, `resourceType`, `resourceId` and `source` are not in ADR-009. Which of them B3 adds is an open detail; `operationId` is covered in §10.
- `message` must never carry secrets. Today the unexpected-error line logs the raw error `message` unfiltered (`09-security-spec.md` §49); redaction is `Planned (B3)` (§11).

---

# 8. Event Naming

**Status:** convention `Planned (B3)` (ADR-009 point 3); event names by block (table below)

Event names should be stable, predictable and machine-readable.

Recommended convention:

```text
<domain>.<resource>.<action>
```

Examples:

```text
http.request.completed
auth.login.succeeded
auth.login.failed
auth.refresh.reuse_detected
authz.denied
portfolio.created
portfolio.updated
position.updated
transaction.created
analytics.calculated
job.started
job.progress
job.completed
job.failed
realtime.connected
realtime.disconnected
realtime.event.received
demo.failure.injected
demo.scenario.started
```

Event names should describe what happened rather than the implementation method that produced it.

Avoid names such as:

```text
controllerFunctionCalled
someHookFinished
databaseMethodExecuted
```

Prefer domain or infrastructure events.

The convention is a guide, not a fixed length: ADR-009 uses two segments (`job.failed`, `authz.denied`) and three (`http.request.completed`), and a multi-word action uses snake_case (`auth.refresh.reuse_detected`).

| Events | Source | Status |
| --- | --- | --- |
| `http.request.completed` | ADR-009 point 3 (request logs) | `Planned (B3)` |
| `auth.login.succeeded`, `auth.login.failed`, `authz.denied` | ADR-009 point 9, `09-security-spec.md` §50 | `Planned (B3)`; `authz.denied` on role checks from B2 and on realtime subscriptions from B5 |
| `auth.refresh.reuse_detected` | ADR-009 point 9, ADR-005 | `Planned (B2)` / `Planned (B3)` |
| `job.*` (transitions) | ADR-009 point 11, ADR-008 | `Planned (B4)` |
| `realtime.*` (connect, authenticate, close) | ADR-009 point 11, ADR-007, `08-realtime-spec.md` §58 | `Planned (B5)` |
| `demo.*` | ADR-010 point 6 | `Planned (FE)` |
| `portfolio.*`, `position.*`, `transaction.*`, `analytics.*` | none yet | Illustrative; defined with each feature |

Code vs ADR:

- ADR-009 point 9 names the login events `auth.login.succeeded` and `auth.login.failed`, not `success` and `failure`; the list above uses the ADR names.
- Today's code writes `request.failed` and `health.database.unavailable` (§1). Their names under the B3 logger are an open detail; ADR-009 gives only `http.request.completed` for request logs.
- Job transition names other than `job.failed` are not fixed by ADR-009. The job states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` and `TIMED_OUT` (ADR-008 point 3), so `job.progress` and `job.started` above are working names until B4.
- Realtime log names are not final: `08-realtime-spec.md` §58 leaves them open for B5, aligned with this section. `realtime.event.received` describes a client-side event; server-side per-event logging and its level are part of the same open detail. Realtime event types on the wire (`MARKET_PRICE_UPDATED` and the others in `08-realtime-spec.md` §15) are a different namespace from log event names.
- Demo events depend on the frontend-stage demo ADR (ADR-010 point 6).

---

# 9. Request Correlation

**Status:** request ID, header and error-body propagation `Implemented` (`apps/api/src/middleware/request-id.ts`); propagation to log lines `Planned (B3)` (ADR-009 point 5)

Every HTTP request should receive a request identifier.

```text
Client
  │
  │ HTTP Request
  ▼
Request ID Middleware
  │
  ├── Controller
  │
  ├── Application Service
  │
  ├── Repository
  │
  └── Error Handler
```

The same `requestId` should be included in logs generated during that request whenever practical.

If the client supplies a valid correlation identifier, the server may propagate it according to defined security and validation rules. Otherwise, the server should generate one.

The response should expose the request identifier through a response header when appropriate.

Recommended header:

```text
X-Request-ID
```

The header is `X-Request-ID` (`07-api-spec.md` §8).

What exists:

- The `requestId` middleware runs on every request, after `helmet` and `cors` and before the health routes, the rate limiter and the body parser (`apps/api/src/app.ts`).
- A client value is reused only when it matches `^[a-zA-Z0-9-]{1,64}$`; anything else is replaced by a new `randomUUID()`. The value is safe to log and to echo.
- The identifier is set on `req.requestId`, returned in the `X-Request-ID` response header, and included as `requestId` in every error body (`07-api-spec.md` §5).

Code vs ADR:

- The diagram passes through an application service layer, which does not exist yet (ADR-001, B0).
- No log line receives the `requestId` automatically. The two JSON lines of §1 add it by hand. ADR-009 point 5 propagates it through `AsyncLocalStorage` to every log line of a request in B3, with an integration test (ADR-009 point 13).
- `cors` is configured with `origin` only, so a browser on another origin cannot read the `X-Request-ID` header of a successful response; it can read `requestId` from error bodies. Whether to expose the header is an open detail for the frontend stage.

---

# 10. Operation Correlation

**Status:** `jobId` `Planned (B4)` and `connectionId` `Planned (B5)`, both on the B3 logger (ADR-009 point 5); a generic `operationId` `Deferred`

A request ID is not always sufficient.

Long-running or asynchronous work should use an additional operation identifier.

Example:

```text
requestId = req_123
operationId = op_456
```

This is particularly useful for:

- background jobs
- exports
- analytics calculations
- simulated market processing
- transaction processing
- realtime workflows

This allows multiple asynchronous events to be associated with the same logical operation.

Code vs ADR: ADR-009 point 5 does not introduce a generic `operationId`. It uses the identifier each asynchronous unit already has:

| Work | Identifier | Status |
| --- | --- | --- |
| Background job (CSV import) | `jobId` (ADR-008) | `Planned (B4)` |
| Realtime connection | `connectionId` (ADR-007) | `Planned (B5)` |
| HTTP request | `requestId` (§9) | `Implemented`; in log lines `Planned (B3)` |

Several items in the list above are not asynchronous in version 1. Transactions stay synchronous (ADR-008 point 12) and analytics are computed inside the request, so `requestId` covers both; the reconstruction of the analytics series is timed separately (ADR-009 point 8). The only job in version 1 is the CSV import (ADR-008 point 1); there is no export job. Simulated market processing runs in the simulator (`Planned (B5)`, ADR-007). A generic `operationId` stays `Deferred` until a workflow needs one.

---

# 11. Sensitive Data Policy

**Status:** policy `Reference`; enforced redaction `Planned (B3)` (ADR-009 point 4); current lines comply except for the unfiltered error `message`

Logs must never become a secondary storage system for sensitive information.

The logging system must not record:

- passwords
- authentication secrets
- JWT values
- refresh tokens
- API keys
- private credentials
- full authorization headers
- payment credentials
- unrestricted request bodies
- sensitive personal information unless explicitly required

Financial-domain data should also be minimized.

For example, a log should prefer:

```json
{
  "event": "transaction.created",
  "transactionId": "txn_123",
  "portfolioId": "portfolio_456"
}
```

rather than dumping the complete transaction object.

Decided enforcement (ADR-009 point 4 and Deferred detail, B3):

- A fixed redaction list: passwords, the `Authorization` header, cookies, access tokens and refresh tokens.
- Redaction paths also cover the response `Set-Cookie` header and the access token inside the WebSocket `AUTHENTICATE` message (`08-realtime-spec.md` §58).
- The CSV input of an import job is never logged.
- `userId` is logged as an identifier only (ADR-009 point 3).
- Each case has a unit test (ADR-009 point 13).

Code vs ADR:

- Today no line writes request headers or bodies, and `env.ts` logs the names of invalid keys, never their values (`09-security-spec.md` §49).
- The unexpected-error line logs the raw error `message`, which is not filtered. B3 redaction applies to fields; whether error messages are also scrubbed is an open detail (B3).
- Refresh tokens and their cookie do not exist yet (`Planned (B2)`, ADR-005); the redaction list covers them from the start.
- "API keys" and "payment credentials" have no counterpart: the API holds no third-party keys and handles no payments.

---

# 12. Error Handling and Error Tracking

**Status:** central handler and safe responses `Implemented` (`apps/api/src/middleware/error-handler.ts`); category logging `Planned (B3)` (ADR-009 point 6); application error mapping `Planned (B0)` (ADR-001 point 3)

## 12.1 Central Error Boundary

Backend errors must pass through a centralized error-handling mechanism.

```text
Application Error
       │
       ▼
Error Classification
       │
       ├── Expected domain error
       ├── Validation error
       ├── Authentication error
       ├── Authorization error
       ├── Dependency error
       └── Unexpected error
              │
              ▼
       Structured Log
              │
              ▼
       Safe API Response
```

The client should receive a safe, stable error contract.

Internal implementation details must not be exposed to users.

What exists: `errorHandler` is registered last, after an explicit 404 for unmatched routes. It classifies four cases and answers with the body of `07-api-spec.md` §5:

| Case | Response | Logged today |
| --- | --- | --- |
| `AppError` | Its `code`, `statusCode`, `message` and optional `details` | No |
| Body-parser error (`entity.*`) | 400 or 413 `VALIDATION_ERROR` | No |
| Domain `Invalid*Error` / `Insufficient*Error` | 400 `VALIDATION_ERROR` | No |
| Anything else | 500 `INTERNAL_ERROR`, generic message | Yes, `request.failed` at `error`, without the stack |

The rate limiters answer 429 `RATE_LIMITED` themselves, with the same body shape, without passing through the handler (`apps/api/src/middleware/rate-limit.ts`). Stack traces, driver errors and internal messages never reach the client (`09-security-spec.md` §28).

Code vs ADR:

- The diagram's categories are not all distinct today. Authentication and authorization failures are `AppError`s (`UNAUTHORIZED`; `FORBIDDEN` from B2). Dependency errors are not raised: a database outage surfaces as `INTERNAL_ERROR` until B0 maps it to 503 `DEPENDENCY_ERROR` (ADR-002 point 10, `07-api-spec.md` §6).
- ADR-001 point 3 adds transport-free application errors (`NotFoundError`, `ConflictError`) that this handler maps to HTTP in B0.
- ADR-009 point 6 logs every category, with the stack for internal errors (§6.2). Today handled errors leave no log line.

---

## 12.2 Error Categories

Errors should be classified where useful.

Suggested categories:

- `VALIDATION_ERROR`
- `AUTHENTICATION_ERROR`
- `AUTHORIZATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `DEPENDENCY_ERROR`
- `DATABASE_ERROR`
- `REALTIME_ERROR`
- `BACKGROUND_JOB_ERROR`
- `INTERNAL_ERROR`

These categories support consistent frontend behavior and debugging.

Code vs ADR: the codes a client receives are the `AppErrorCode` values of `07-api-spec.md` §6, not the list above:

| Category above | Code on the wire |
| --- | --- |
| `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `DEPENDENCY_ERROR`, `INTERNAL_ERROR` | Same name |
| `AUTHENTICATION_ERROR` | `UNAUTHORIZED` (401) |
| `AUTHORIZATION_ERROR` | `FORBIDDEN` (403), raised by role checks from B2 (ADR-002 point 10) |
| `DATABASE_ERROR` | `DEPENDENCY_ERROR` (503) for an unreachable database, `Planned (B0)` (ADR-002 point 10); other database failures are `INTERNAL_ERROR` |
| `REALTIME_ERROR` | Not an HTTP code: realtime failures use the `ERROR` message `code` and the close codes of ADR-007 point 15 (`08-realtime-spec.md`) |
| `BACKGROUND_JOB_ERROR` | Not an HTTP code: a failed job ends in the `FAILED` state (ADR-008 point 3) and a `JOB_FAILED` event (ADR-008 point 11) |

`TIMEOUT` is declared in `AppErrorCode` but never raised; it is removed in B0 (ADR-002 point 10). Whether the log field `errorCategory` (ADR-009 point 3) uses these wire codes is an open detail (B3, §7).

---

# 13. Error Context

An error event should include enough context to investigate the problem.

Recommended fields:

```json
{
  "level": "error",
  "event": "request.failed",
  "requestId": "req_123",
  "operationId": "op_456",
  "errorName": "DatabaseError",
  "errorCode": "DATABASE_ERROR",
  "source": "portfolio.repository",
  "durationMs": 42
}
```

Stack traces should be available in development and controlled environments.

Production logging must balance diagnostic usefulness with information exposure.

---

# 14. Frontend Error Observability

The frontend must provide a centralized mechanism for unexpected runtime errors.

Relevant error sources include:

- component rendering failures
- API errors
- query failures
- realtime failures
- form submission failures
- background operation failures
- unexpected state errors

React error boundaries should be used where appropriate.

The frontend should distinguish between:

```text
Expected user-facing error
```

and:

```text
Unexpected application error
```

Expected errors should produce appropriate UX.

Unexpected errors should be logged through the frontend observability abstraction.

---

# 15. Error Boundaries

Critical UI areas should be isolated so that one failure does not unnecessarily break the entire application.

Possible boundaries include:

- application shell
- dashboard
- portfolio view
- analytics
- transaction workflows
- realtime panels
- background job panels

A boundary should provide:

- safe fallback UI
- retry/recovery where possible
- diagnostic context
- request/operation identifiers where applicable

The fallback should not expose stack traces to end users.

---

# 16. Metrics Strategy

Metrics provide aggregated information about runtime behavior.

The initial system should prioritize a small set of meaningful metrics instead of collecting everything.

Metrics should cover:

- request behavior
- application errors
- database health
- realtime behavior
- background jobs
- demo simulations
- performance

---

# 17. HTTP Metrics

The backend should measure, where practical:

- total requests
- requests by route
- requests by method
- status code distribution
- error count
- request duration
- active requests

Conceptual metrics:

```text
http_requests_total
http_request_duration_ms
http_errors_total
```

Labels should remain bounded.

Avoid labels containing:

- user IDs
- transaction IDs
- portfolio IDs
- arbitrary URLs
- request parameters

High-cardinality labels can create unnecessary memory and processing overhead.

---

# 18. Application Metrics

Useful application-level measurements may include:

```text
portfolio_operations_total
transaction_operations_total
analytics_calculations_total
background_jobs_total
background_jobs_failed_total
```

The exact metric set should be finalized based on the implementation.

Metrics must represent actual events.

The system must never expose fabricated values merely to make the project appear more performant.

---

# 19. Realtime Metrics

The realtime layer requires specific instrumentation.

Useful measurements include:

- active websocket connections
- connections opened
- connections closed
- reconnect attempts
- realtime errors
- events published
- events delivered
- subscriptions created
- subscriptions removed
- event processing duration

Conceptual metrics:

```text
websocket_connections_active
websocket_connections_total
websocket_reconnects_total
realtime_events_total
realtime_errors_total
realtime_event_processing_ms
```

The implementation must avoid unbounded per-user or per-event metric dimensions.

---

# 20. Background Job Metrics

Background processing should expose lifecycle measurements.

For each job type, the system should be able to observe:

```text
queued
started
progressed
completed
failed
cancelled
timed_out
```

Useful metrics:

```text
background_jobs_started_total
background_jobs_completed_total
background_jobs_failed_total
background_jobs_cancelled_total
background_jobs_duration_ms
```

The demo mode defined in `12-demo-mode-spec.md` should use the same conceptual lifecycle.

---

# 21. Database Observability

The PostgreSQL integration should provide basic visibility into database health.

The system should be able to determine:

- whether a database connection can be established
- whether a lightweight query succeeds
- whether the connection pool is functioning
- whether a repository operation fails
- whether database operations are unexpectedly slow

Database logs should not include unrestricted SQL or sensitive parameters in normal operation.

Development diagnostics may expose more detail when explicitly enabled.

---

# 22. Health Checks

The backend must expose health endpoints.

At minimum:

```text
GET /health
```

and preferably a dependency-aware endpoint such as:

```text
GET /health/ready
```

The exact endpoint names can be finalized during API implementation.

---

# 23. Liveness vs Readiness

Health checks should distinguish between process health and dependency readiness.

### Liveness

Answers:

> Is the application process running?

It should be lightweight and should not depend on every external dependency.

### Readiness

Answers:

> Is the application ready to serve requests requiring its dependencies?

It may validate:

- database availability
- required internal services
- critical configuration

Example:

```json
{
  "status": "ok",
  "service": "trading-api",
  "checks": {
    "database": "ok"
  }
}
```

The response schema should remain stable and machine-readable.

---

# 24. Health Check Security

Health endpoints must not expose:

- credentials
- connection strings
- environment secrets
- internal topology
- database error details
- sensitive configuration

Detailed diagnostics should remain development-only.

---

# 25. Performance Observability

Performance must be measurable rather than assumed.

The application should instrument important operations.

Examples:

- API request duration
- database operation duration
- analytics calculation duration
- background job duration
- realtime event processing duration
- frontend route/load timing
- expensive table or chart computations where practical

---

# 26. Timing Instrumentation

A generic timing abstraction should be available.

Conceptually:

```text
startTimer()
    │
    ▼
operation
    │
    ▼
stopTimer()
    │
    ├── duration
    ├── success/failure
    └── contextual metadata
```

Timing instrumentation should not require every function to manually implement logging logic.

---

# 27. Frontend Performance Diagnostics

The frontend should provide development-friendly visibility into expensive operations.

Potential areas:

- API request duration
- query lifecycle
- cache hits/misses where available
- component render diagnostics during development
- realtime update frequency
- chart update frequency
- table processing time
- background operation progress

Development diagnostics must be removable or disabled in production builds when they create unnecessary overhead.

---

# 28. Realtime Debugging

The realtime subsystem should expose enough diagnostic information to understand connection behavior.

Development diagnostics may include:

```text
CONNECT
SUBSCRIBE
EVENT_RECEIVED
EVENT_APPLIED
DISCONNECT
RECONNECT
SYNC
ERROR
```

Example:

```text
[realtime] connected
[realtime] subscribed: portfolio:123
[realtime] event received: price.updated
[realtime] event applied
```

Sensitive payload data should not be dumped indiscriminately.

A development-only debug mode may show sanitized payload summaries.

---

# 29. Demo Mode Observability

The demo environment defined in `12-demo-mode-spec.md` must participate in the same observability architecture.

Demo-specific events may include:

```text
demo.started
demo.reset
demo.scenario.started
demo.scenario.completed
demo.latency.applied
demo.failure.injected
demo.network.changed
demo.realtime.started
demo.realtime.stopped
demo.job.started
demo.job.failed
```

This makes the simulated infrastructure observable in the same way as real infrastructure.

The goal is to demonstrate that the demo is an infrastructure substitution rather than a separate application.

---

# 30. Simulation Diagnostics

When a demo simulation is active, diagnostics should identify:

- current scenario
- simulation mode
- latency profile
- failure profile
- realtime simulation state
- background jobs
- persistence state
- deterministic seed when applicable

These details should be visible primarily to developers or through an explicit demo diagnostics interface.

---

# 31. Local Observability

The project must be fully observable locally without requiring paid services.

A developer should be able to inspect:

```text
Application logs
       │
       ├── Request IDs
       ├── Error events
       ├── Realtime events
       ├── Background jobs
       └── Demo simulations

Health endpoints
       │
       ├── API
       └── Database

Development diagnostics
       │
       ├── Browser console
       ├── Network panel
       └── Application diagnostics
```

The exact tooling may evolve during implementation.

---

# 32. No Paid Observability Dependency

The project must not require a recurring paid service for:

- logs
- metrics
- error tracking
- health monitoring
- performance diagnostics

The architecture should use abstractions so a hosted observability provider can be added later without rewriting application code.

Potential future integrations may include:

- hosted log aggregation
- managed metrics
- error tracking platforms
- OpenTelemetry-compatible systems

These are optional extensions, not project requirements.

---

# 33. Provider-Agnostic Observability

Application code should depend on internal interfaces rather than directly on a third-party observability SDK.

Conceptually:

```text
Application
     │
     ▼
Observability Interface
     │
     ├── Local Logger
     ├── Local Metrics
     ├── Local Diagnostics
     └── Future Provider Adapter
```

Example conceptual interface:

```ts
interface Observability {
  log(event: LogEvent): void;
  metric(event: MetricEvent): void;
  error(error: ObservabilityError): void;
  startSpan?(name: string): Span;
}
```

The exact API should be determined during implementation.

---

# 34. OpenTelemetry Consideration

The architecture should remain compatible with OpenTelemetry concepts where practical.

This does not mean that a hosted telemetry backend is required.

The system may later support:

```text
Application
    │
    ▼
OpenTelemetry instrumentation
    │
    ├── Traces
    ├── Metrics
    └── Logs
          │
          ▼
   Configurable exporter
```

For the initial implementation, complexity should remain proportional to the project.

OpenTelemetry should be introduced when it provides meaningful architectural value rather than simply because it is available.

---

# 35. Tracing Strategy

Distributed tracing is not a mandatory initial feature because the project is primarily a single application architecture.

However, trace-compatible concepts should be preserved:

- request ID
- operation ID
- parent/child operation relationships
- duration
- service/module boundaries

This allows future distributed tracing to be introduced without changing domain behavior.

---

# 36. Debugging Workflow

The system should support a predictable debugging workflow.

### Step 1 — Identify the symptom

Example:

> Portfolio update failed.

### Step 2 — Capture request/operation ID

Example:

```text
requestId: req_123
```

### Step 3 — Search logs

Find events associated with:

```text
req_123
```

### Step 4 — Identify the failing layer

```text
Controller
  ↓
Application Service
  ↓
Repository
  ↓
Database
```

### Step 5 — Inspect the error category

Determine whether it is:

- validation
- authorization
- domain
- dependency
- database
- unexpected

### Step 6 — Reproduce

Use the same application flow locally.

### Step 7 — Use development diagnostics

Enable more detailed logging only when necessary.

### Step 8 — Validate recovery

Confirm that retries, rollback, reconnect or user-facing recovery work correctly.

---

# 37. Debug Context

Debug information should provide context without creating noise.

Useful context includes:

```text
requestId
operationId
event
module
resource
duration
status
errorCode
```

Avoid excessive messages such as:

```text
entered function
left function
entered another function
```

unless temporarily enabled for focused debugging.

---

# 38. Logging Configuration

Logging should be configurable by environment.

Example conceptual configuration:

```text
development
  level: debug
  pretty output: enabled
  stack traces: enabled

test
  level: warn/error
  deterministic output

production
  level: info
  structured output
  sensitive data filtering
```

The exact values may change during implementation.

---

# 39. Development Diagnostic Mode

A development-only diagnostic mode may provide:

- request IDs
- API timings
- realtime connection status
- active subscriptions
- background job state
- demo simulation state
- failure injection state
- selected cache/query diagnostics

This mode must not be enabled automatically in production.

---

# 40. Browser Diagnostics

The frontend should integrate naturally with standard browser developer tools.

Developers should be able to inspect:

### Console

- sanitized application events
- warnings
- unexpected errors
- realtime lifecycle events in debug mode

### Network

- request IDs
- status codes
- request duration
- response errors

### Application

- local demo state
- persisted state
- storage version
- authentication state where safe

No secrets should be intentionally exposed through diagnostics.

---

# 41. Observability and State Management

Observability must not create unnecessary global state.

Zustand should not become a general-purpose log store.

Instead:

```text
Application event
       │
       ▼
Observability service
       │
       ├── Console
       ├── Local metrics
       └── Optional future exporter
```

Only information that is genuinely needed by the UI should enter application state.

---

# 42. Observability and TanStack Query

TanStack Query operations should remain observable through existing query lifecycle mechanisms.

Useful diagnostics include:

- query start
- query success
- query error
- mutation start
- mutation success
- mutation error
- retry
- invalidation

The application should avoid logging complete query payloads by default.

---

# 43. Observability and Background Tasks

Background operations must emit lifecycle events.

Example:

```text
job.started
     │
     ▼
job.progress
     │
     ▼
job.progress
     │
     ▼
job.completed
```

Failure:

```text
job.started
     │
     ▼
job.progress
     │
     ▼
job.failed
```

Timeout:

```text
job.started
     │
     ▼
job.timed_out
```

Cancellation:

```text
job.started
     │
     ▼
job.cancelled
```

These events should correlate through `operationId`.

---

# 44. Observability and Security Events

Security-relevant events should be observable.

Examples:

```text
auth.login.success
auth.login.failure
auth.logout
auth.token.refresh.failure
auth.authorization.denied
```

These events should never log authentication secrets.

For failed authentication attempts, useful context may include:

- timestamp
- request ID
- route
- sanitized client context
- failure category

Avoid storing excessive identifying information.

---

# 45. Audit vs Operational Logs

Operational logs and audit records are different concepts.

### Operational logs

Used to debug and operate the application.

Examples:

- request failed
- database unavailable
- websocket disconnected

### Audit records

Used to record important user actions when the product requires traceability.

Examples:

- portfolio created
- transaction deleted
- role changed

Audit requirements should be implemented separately from generic logging if they become necessary.

Operational logs must not be treated as permanent audit storage.

---

# 46. Log Retention

Because the project is designed for local/free infrastructure, retention should remain simple.

Local development logs may be:

- streamed to stdout
- written to local files when useful
- rotated to avoid unbounded growth

The application must not continuously append to an unlimited log file.

Container environments should preferably treat stdout/stderr as the primary log stream.

---

# 47. Log Rotation

If file logging is enabled locally, rotation must be bounded by:

- maximum file size
- number of retained files
- optional time-based rotation

Example conceptual policy:

```text
application.log
application.log.1
application.log.2
```

Exact values are implementation details.

---

# 48. Metrics Storage

The initial metrics implementation should favor lightweight local mechanisms.

Possible approaches include:

- in-memory counters
- in-memory histograms
- development endpoint
- standard process metrics where appropriate

Metrics must not grow without bounds.

If an in-memory metric is used, its lifecycle should be clearly defined.

---

# 49. Metrics Endpoint

A development or internal metrics endpoint may be provided.

Conceptually:

```text
GET /metrics
```

The endpoint should be disabled, protected or restricted depending on deployment requirements.

It must not expose secrets or sensitive application state.

If Prometheus-compatible output is adopted, metric naming and label cardinality should follow Prometheus conventions.

---

# 50. Process Metrics

The backend may expose basic process measurements such as:

- process uptime
- memory usage
- CPU usage where available
- event-loop behavior where useful
- active connections

These are diagnostics, not promises of performance.

They should be used to identify issues rather than to create artificial benchmarks.

---

# 51. Performance Baselines

The project may establish performance baselines during implementation.

Examples of measurements that could be established:

- API request duration distribution
- database query duration
- analytics calculation duration
- realtime processing duration
- frontend interaction timing

No baseline should be documented as a project result until it has actually been measured.

---

# 52. Performance Thresholds

Diagnostic thresholds may be configured to identify suspicious operations.

For example:

```text
if duration > diagnosticThreshold
    emit warning
```

Thresholds should be configurable.

They should not automatically be presented as user-facing SLA guarantees.

---

# 53. Slow Operation Diagnostics

A slow operation should generate a useful diagnostic event.

Example:

```json
{
  "level": "warn",
  "event": "operation.slow",
  "operationId": "op_456",
  "source": "analytics.service",
  "durationMs": 842
}
```

The threshold and exact fields should be implementation-configurable.

---

# 54. Observability Overhead

Instrumentation must not significantly alter application behavior.

Avoid:

- serializing huge objects
- excessive console logging
- synchronous heavy log processing
- storing unlimited events in memory
- logging every realtime payload
- logging every render in normal development

The observability system itself should be observable if it becomes sufficiently complex.

---

# 55. Realtime Event Sampling

High-frequency realtime events may require sampling for diagnostics.

The product may process every event while diagnostics record only a subset.

For example:

```text
Realtime stream
       │
       ├── Product processing → every event
       │
       └── Debug logging → sampled events
```

This prevents logs from becoming the bottleneck.

---

# 56. Demo Realtime Logging

Demo mode should make simulated realtime behavior understandable without flooding the console.

Instead of logging every simulated price tick by default, log lifecycle events such as:

```text
simulation.started
simulation.paused
simulation.resumed
simulation.stopped
simulation.error
```

Detailed tick logging can be enabled explicitly for debugging.

---

# 57. Health Check Failure Behavior

If a dependency becomes unavailable:

- readiness should reflect the dependency state
- errors should be logged
- requests should receive appropriate error responses
- recovery should be observable
- the application should not crash unnecessarily

For demo mode, dependency failures may be simulated according to `12-demo-mode-spec.md`.

---

# 58. Recovery Observability

Recovery events are as important as failures.

Examples:

```text
database.recovered
realtime.reconnected
job.retry
dependency.recovered
demo.failure.recovered
```

A useful observability system should show the complete lifecycle:

```text
failure
  ↓
retry/recovery
  ↓
success
```

---

# 59. Observability Testing

Observability itself must be tested.

Tests should verify:

### Logging

- expected events are emitted
- correct severity is used
- request IDs propagate
- sensitive fields are removed

### Errors

- expected errors are classified
- unexpected errors are logged
- API responses remain safe

### Metrics

- counters increment correctly
- durations are recorded
- metric labels remain bounded

### Health

- healthy dependencies report correctly
- unhealthy dependencies are detected
- liveness remains lightweight

### Realtime

- connect/disconnect events are observable
- reconnects are observable
- failures are observable

### Demo

- simulated failures produce diagnostics
- resets clear relevant state
- scenarios produce expected lifecycle events

---

# 60. Unit Tests for Observability

Unit tests should cover:

- logger adapters
- event normalization
- error classification
- sensitive-data sanitization
- request ID generation
- metric counters
- timing helpers
- health-check aggregation
- demo observability events

Tests should avoid depending on wall-clock timing when possible.

---

# 61. Integration Tests for Observability

Integration tests should validate:

```text
HTTP Request
   ↓
Request ID
   ↓
Application
   ↓
Repository
   ↓
Log / Metric
```

Examples:

- successful request emits expected event
- failed request includes request ID
- database failure produces correct error classification
- health endpoint reports database state

---

# 62. E2E Observability Tests

End-to-end tests should validate user-visible recovery rather than implementation-specific log formatting.

Examples:

- user submits invalid transaction
- API returns validation error
- UI displays validation state
- request remains traceable during development

For realtime:

- connection established
- update received
- UI reflects update
- simulated disconnect
- reconnect
- UI recovers

The exact logs should not become brittle E2E assertions unless necessary.

---

# 63. Observability in CI

CI should validate that:

- tests pass
- linting passes
- type checking passes
- production builds succeed
- observability code does not introduce unsafe dependencies
- environment-specific logging configuration is valid

CI itself does not need a paid observability platform.

---

# 64. Failure Injection

The demo system should reuse the observability infrastructure to make simulated failures visible.

Examples:

```text
API failure
   ↓
request.failed
   ↓
error surfaced
   ↓
UI recovery

Realtime failure
   ↓
realtime.disconnected
   ↓
reconnect attempt
   ↓
realtime.reconnected
```

This provides a strong technical demonstration during interviews.

---

# 65. Interview Demonstration

Observability should be demonstrable in a short technical walkthrough.

Suggested sequence:

### 1. Show the product

Demonstrate a normal user flow.

### 2. Open developer diagnostics

Show the request lifecycle.

### 3. Perform an operation

Show:

```text
requestId
operation
duration
result
```

### 4. Inject a failure

Trigger a controlled demo failure.

### 5. Inspect recovery

Show:

```text
failure
→ retry
→ recovery
```

### 6. Demonstrate realtime

Show:

```text
connected
→ event
→ state update
→ disconnect
→ reconnect
```

### 7. Show health

Open the health endpoint.

This demonstrates that the application is observable by design.

---

# 66. Local Developer Experience

A new developer should be able to understand the system without installing a paid monitoring platform.

The repository should document:

- how to start the application
- where logs appear
- how to change log level
- how to enable debug mode
- how to inspect health
- how to inspect metrics
- how to simulate failures
- how to inspect realtime events
- how to reproduce common failures

---

# 67. Documentation Requirements

The repository should contain an observability section in the developer documentation.

It should explain:

```text
Observability
├── Logging
├── Request correlation
├── Errors
├── Metrics
├── Health checks
├── Realtime diagnostics
├── Demo diagnostics
├── Performance
└── Troubleshooting
```

The documentation should favor practical examples over theoretical descriptions.

---

# 68. Environment Variables

Observability configuration may use environment variables.

Conceptual examples:

```text
LOG_LEVEL
LOG_FORMAT
ENABLE_DEBUG_LOGGING
ENABLE_METRICS
ENABLE_DEV_DIAGNOSTICS
SLOW_OPERATION_THRESHOLD_MS
```

The exact variables should be finalized during implementation.

Secrets must never be stored in source control.

---

# 69. Production Considerations

Even though the project prioritizes local/free infrastructure, the architecture should be production-aware.

Production observability should support:

- structured stdout logs
- request correlation
- safe error handling
- health checks
- bounded metrics
- realtime diagnostics
- configurable verbosity

A hosted provider can later consume these outputs.

The core application should not need to know which provider is being used.

---

# 70. Future Evolution

Potential future improvements include:

- OpenTelemetry tracing
- Prometheus metrics
- Grafana dashboards
- centralized log aggregation
- hosted error tracking
- distributed tracing
- alerting
- SLO/SLI definitions
- anomaly detection

These are explicitly outside the minimum implementation unless later justified.

The architecture should allow them without requiring a redesign.

---

# 71. Anti-Patterns to Avoid

The implementation must avoid:

### Logging everything

High-volume logs reduce signal and can hurt performance.

### Logging raw objects

Large objects may contain secrets or sensitive information.

### Logging secrets

Never acceptable.

### User IDs as metric labels

Creates unnecessary cardinality.

### Request IDs as metric labels

Request IDs belong in logs/traces, not aggregate metric labels.

### Console logging everywhere

Use the centralized observability abstraction.

### Provider lock-in

Do not couple domain/application code to a hosted observability provider.

### Fake metrics

Do not manufacture impressive numbers.

### Fake health

A health endpoint should reflect actual application state.

### Debugging through production-only behavior

Important diagnostics should be reproducible locally.

---

# 72. Responsibility by Layer

| Layer | Observability responsibility |
|---|---|
| UI | User-visible errors, runtime boundaries, diagnostics |
| Features | Meaningful user-flow events |
| Application | Operation lifecycle and business-context diagnostics |
| Domain | Domain events where useful |
| Infrastructure | Dependency errors and performance |
| API | Request correlation, status, duration |
| Realtime | Connection/event lifecycle |
| Database | Connectivity and operation diagnostics |
| Demo infrastructure | Simulation lifecycle and failures |
| Observability layer | Logging, metrics, sanitization, correlation |

---

# 73. Relationship With Demo Architecture

The observability architecture must preserve the same abstraction boundary established in `12-demo-mode-spec.md`.

```text
                    Application
                         │
                ┌────────┴────────┐
                │                 │
          Real infrastructure   Demo infrastructure
                │                 │
                └────────┬────────┘
                         │
                  Observability
                         │
             ┌───────────┼───────────┐
             │           │           │
           Logs       Metrics      Health
```

A real database failure and a simulated database failure should be distinguishable, but both should travel through the same conceptual observability mechanisms.

---

# 74. Definition of Done

The observability implementation is considered complete when:

### Logging

- [ ] Backend logs are structured.
- [ ] Log levels are supported.
- [ ] Stable event names are used.
- [ ] Sensitive data is sanitized.
- [ ] Request IDs are propagated.

### Errors

- [ ] Backend errors are centrally handled.
- [ ] Error categories are standardized.
- [ ] Frontend runtime errors have boundaries.
- [ ] Unexpected errors are observable.
- [ ] User-facing errors remain safe.

### Metrics

- [ ] Core HTTP metrics exist.
- [ ] Relevant application metrics exist.
- [ ] Realtime metrics exist.
- [ ] Background job metrics exist.
- [ ] Metrics remain bounded.

### Health

- [ ] Liveness is available.
- [ ] Readiness is available where appropriate.
- [ ] Database health is detectable.
- [ ] Health output contains no secrets.

### Performance

- [ ] Important operations can be timed.
- [ ] Slow operations can be diagnosed.
- [ ] No performance claim is made without measurement.

### Realtime

- [ ] Connections are observable.
- [ ] Reconnects are observable.
- [ ] Realtime errors are observable.
- [ ] Debug logging can be controlled.

### Demo

- [ ] Demo lifecycle is observable.
- [ ] Simulated failures are observable.
- [ ] Realtime simulation is observable.
- [ ] Background simulations are observable.
- [ ] Reset clears appropriate diagnostic state.

### Testing

- [ ] Observability utilities have unit tests.
- [ ] Request correlation has integration coverage.
- [ ] Error handling has integration coverage.
- [ ] Health checks are tested.
- [ ] Critical demo failure scenarios are tested.

### Documentation

- [ ] Local observability workflow is documented.
- [ ] Log levels are documented.
- [ ] Health endpoints are documented.
- [ ] Demo diagnostics are documented.
- [ ] Troubleshooting workflow is documented.

---

# 75. Acceptance Criteria

The specification is satisfied when a developer can reproduce a failure locally and answer:

1. What operation failed?
2. Which request initiated it?
3. Which application layer failed?
4. What type of error occurred?
5. Was the failure expected or unexpected?
6. Was a retry attempted?
7. Did the system recover?
8. What was the approximate operation duration?
9. Was a dependency involved?
10. Can the same failure be reproduced locally?

The system should make these questions answerable without requiring a commercial monitoring platform.

---

# 76. Final Architecture Principle

The observability architecture follows one central principle:

> **If the system cannot explain what happened, it is harder to maintain than it needs to be.**

The goal is not to instrument every line of code.

The goal is to make important system behavior visible:

```text
Request
   ↓
Operation
   ↓
Dependency
   ↓
Result
   ↓
Recovery
```

For the Trading Analytics Platform, observability is part of the engineering story.

It demonstrates that the system was designed not only to work, but also to be **understood, debugged, measured, tested and evolved**.

---

## 77. Relationship to Other SDDs

This document depends on and complements:

- `00-overview.md` — project scope and principles
- `01-product-spec.md` — product behavior
- `02-functional-requirements.md` — functional requirements
- `03-non-functional-requirements.md` — quality attributes
- `04-tech-stack.md` — technical stack
- `06-architecture.md` — system architecture
- `07-api-spec.md` — API contracts
- `08-realtime-spec.md` — realtime architecture
- `09-security-spec.md` — security specification
- `10-testing-strategy.md` — testing approach
- `11-ui-ux-spec.md` — interface and UX behavior
- `12-demo-mode-spec.md` — demo infrastructure and simulation

The next document, `14-deployment-spec.md`, will define how the application is packaged, configured, deployed and run across local and production-like environments.

---

# Document Status

**Status:** Ready for implementation alignment

This document defines the target observability architecture. Concrete libraries, thresholds, metric names and deployment-specific exporters may be selected during implementation as long as they preserve the architectural principles and acceptance criteria defined here.
