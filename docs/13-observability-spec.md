# SDD 13 — Observability Specification

**Project:** Trading Analytics Platform  
**Document:** Observability Specification  
**Version:** 1.0  
**Status:** All sections reconciled with the code and ADRs on 2026-10-07; the decisions approved on 2026-10-07 (ADR-009 points 2-13, ADR-006 point 12, ADR-001 point 8) are applied; the details they leave open are recorded per section  
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

The `Logger` port, `pino` and request logs replace these in B3 (ADR-009 points 1-2). The unexpected-error line is then named `http.request.failed`, and the readiness line keeps `health.database.unavailable` (ADR-009 point 6).

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

The library is decided: `pino` for structured JSON logs, `pino-http` for request logs and `pino-pretty` in development only (ADR-009 point 2). Each event is one JSON line on stdout; there are no log files (ADR-009 point 3). The format follows the environment: JSON on stdout, and `pino-pretty` only in development. `LOG_FORMAT`, `ENABLE_DEBUG_LOGGING` and `ENABLE_DEV_DIAGNOSTICS` are not adopted (ADR-009 point 2).

Code vs ADR:

- None of the three packages is a dependency yet. The two JSON lines written today (§1) already carry `level`, `event` and `requestId`, but no `timestamp`, and they go to stderr through `console.error`.
- The example above shows `service` and `environment`, which ADR-009 point 3 adds (amended 2026-10-07), and `portfolioId`, which it does not list; `portfolioId` belongs to the illustrative event. See §7 for the field set.
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
| Forbidden (`FORBIDDEN`), rate limited (`RATE_LIMITED`) | `warn` |
| Not found (`NOT_FOUND`), conflict (`CONFLICT`) | `info` |
| Dependency failure (`DEPENDENCY_ERROR`) | `error`, with the stack trace |
| Internal error (`INTERNAL_ERROR`) | `error`, with the stack trace |

A request slower than the configured threshold (default 500 ms, `SLOW_REQUEST_THRESHOLD_MS`) is a `warn` entry (ADR-009 point 8).

Code vs ADR:

- Today only unexpected errors and readiness failures are logged, both at `error` and without the stack trace. Handled errors are not logged.
- The levels of `FORBIDDEN`, `RATE_LIMITED` and `DEPENDENCY_ERROR` are decided: `warn`, `warn` and `error` with the stack (ADR-009 point 6, amended 2026-10-07). `Planned (B3)`.
- ADR-009 fixes no level for the startup, shutdown or simulator entries (§23, §56). Open detail (B3, B5).
- `TRACE` is not part of the decided levels. `pino` supports it, but no configuration uses it.
- Some examples above belong to later stages. Retries: the job runner retries only on request (ADR-008 point 6, B4); HTTP client retries are decided in the frontend-stage ADR (ADR-006 point 11). Simulated failures and demo scenarios are demo features (`Planned (FE)`, ADR-010 point 6) and log through the browser-console adapter (ADR-009 point 1). WebSocket events are `Planned (B5)`; their per-event level is an open detail of `08-realtime-spec.md` §58.

---

# 7. Structured Log Schema

**Status:** `Planned (B3)` (ADR-009 points 3 and 5)

A common base schema should be used whenever possible.

Fields of version 1 (ADR-009 point 3, amended 2026-10-07):

| Field | Purpose | Version 1 |
|---|---|---|
| `timestamp` | Event time | Adopted |
| `level` | Severity | Adopted |
| `service` | Application/service name | Adopted |
| `environment` | Runtime environment | Adopted |
| `event` | Stable event identifier | Adopted |
| `message` | Human-readable description | Adopted |
| `requestId` | HTTP correlation identifier | Adopted |
| `userId` | Internal user identifier when appropriate | Adopted |
| `durationMs` | Operation duration when applicable | Adopted |
| `errorCategory` | The `AppErrorCode` wire value of the error | Adopted |
| `errorName` | Error class name | Adopted on the unexpected-error line only, next to the stack |
| `jobId`, `connectionId` | Correlation of jobs and realtime connections (ADR-009 point 5) | Adopted |
| `operationId` | Logical operation identifier | Not adopted |
| `resourceType` | Domain resource type | Not adopted |
| `resourceId` | Relevant resource identifier | Not adopted |
| `source` | Layer/module that emitted the event | Not adopted |
| `module` | Module that emitted the event | Not adopted |

Not every log event requires every field.

Code vs ADR:

- ADR-009 point 3 decides `timestamp`, `level`, `service`, `environment`, `event`, `message`, `requestId`, `userId` (identifier only), `durationMs` and `errorCategory` where relevant. Point 5 adds `jobId` for jobs and `connectionId` for realtime connections.
- `errorCategory` carries the `AppErrorCode` wire value (§12.2; ADR-002 point 10), so the earlier `errorCode` row is folded into it. `errorName` is kept only on the unexpected-error line, next to the stack (ADR-009 point 3). Today's lines write `errorName` on both (§1).
- `source`, `module`, `resourceType`, `resourceId` and `operationId` are not adopted in v1 (ADR-009 point 3, Deferred detail). `requestId`, `jobId` and `connectionId` are the correlation fields; `operationId` is covered in §10.
- `message` must never carry secrets. Today the unexpected-error line logs the raw error `message` unfiltered (`09-security-spec.md` §49). Redaction covers only the named fields of ADR-009 point 4 (§11), and the `message` of an unexpected error stays unfiltered in v1 (ADR-009 point 4). `Planned (B3)`.

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
| `http.request.failed` (unexpected error), `health.database.unavailable` (readiness failure) | ADR-009 point 6 | `Planned (B3)` |
| `auth.login.succeeded`, `auth.login.failed`, `authz.denied` | ADR-009 point 9, `09-security-spec.md` §50 | `Planned (B3)`; `authz.denied` on role checks from B2 and on realtime subscriptions from B5 |
| `auth.refresh.reuse_detected` | ADR-009 point 9, ADR-005 | `Planned (B2)` / `Planned (B3)` |
| `auth.logout` | ADR-009 point 9 (amended 2026-10-07) | `Planned (B2)`, with the endpoint |
| `app.shutdown.started`, `app.shutdown.completed` | ADR-009 point 11, ADR-006 point 12 | `Planned (B3)` |
| `simulation.started`, `simulation.paused`, `simulation.mode.changed` | ADR-009 point 11, ADR-007 point 15 | `Planned (B5)` |
| `job.*` (transitions) | ADR-009 point 11, ADR-008 | `Planned (B4)` |
| `realtime.*` (connect, authenticate, close) | ADR-009 point 11, ADR-007, `08-realtime-spec.md` §58 | `Planned (B5)` |
| `demo.*` | ADR-010 point 6 | `Planned (FE)` |
| `portfolio.*`, `position.*`, `transaction.*`, `analytics.*` | none yet | Illustrative; defined with each feature |

Code vs ADR:

- ADR-009 point 9 names the login events `auth.login.succeeded` and `auth.login.failed`, not `success` and `failure`; the list above uses the ADR names.
- Today's code writes `request.failed` and `health.database.unavailable` (§1). Under the B3 logger the first becomes `http.request.failed` and the second keeps its name (ADR-009 point 6, amended 2026-10-07). `http.request.completed` is the request log (ADR-009 point 3).
- The simulator names follow the endpoints (ADR-007 point 15). There is no `simulation.resumed` (`start` from `HALTED` is the resume) and no `simulation.stopped` (real mode has no stop); `simulation.error` is deferred until simulator errors are defined (ADR-009 point 11, Deferred detail; §56).
- Job transition names other than `job.failed` are not fixed by ADR-009. The job states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` and `TIMED_OUT` (ADR-008 point 3), so `job.progress` and `job.started` above are working names until B4.
- Realtime log names are not final: `08-realtime-spec.md` §58 leaves them open for B5, aligned with this section. `realtime.event.received` describes a client-side event; server-side per-event logging and its level are part of the same open detail. Realtime event types on the wire (`MARKET_PRICE_UPDATED` and the others in `08-realtime-spec.md` §15) are a different namespace from log event names.
- Demo events depend on the frontend-stage demo ADR (ADR-010 point 6).

---

# 9. Request Correlation

**Status:** request ID, header and error-body propagation `Implemented` (`apps/api/src/middleware/request-id.ts`); propagation to log lines `Planned (B3)` (ADR-009 point 5); exposing the header through CORS `Planned (B3)` (ADR-009 point 5)

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
- `cors` is configured with `origin` only, so today a browser on another origin cannot read the `X-Request-ID` header of a successful response; it can read `requestId` from error bodies. The header is exposed through CORS with `exposedHeaders` (ADR-009 point 5, amended 2026-10-07). `Planned (B3)`.

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

**Status:** policy `Reference`; enforced redaction `Planned (B3)` (ADR-009 point 4); current lines comply except for the unfiltered error `message`, which stays unfiltered in v1 (ADR-009 point 4)

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
- The unexpected-error line logs the raw error `message`, which is not filtered. B3 redaction applies only to the named fields of the list above; the `message` of an unexpected error is logged unfiltered in v1 because logs go to local stdout (ADR-009 point 4, amended 2026-10-07). Hosting the backend (ADR-006 point 2) reopens this decision (ADR-009 points 4 and 10).
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
- ADR-009 point 6 logs every category, with the stack for internal errors and for `DEPENDENCY_ERROR` (§6.2). Today handled errors leave no log line.

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

`TIMEOUT` is declared in `AppErrorCode` but never raised; it is removed in B0 (ADR-002 point 10). The log field `errorCategory` carries these wire codes (ADR-009 point 3, amended 2026-10-07; §7), not the suggested names above. `Planned (B3)`.

---

# 13. Error Context

**Status:** `Planned (B3)` (ADR-009 points 3, 5 and 6); a reduced context is written today (table below)

An error event should include enough context to investigate the problem.

Recommended fields:

```json
{
  "timestamp": "2026-10-06T12:00:00.000Z",
  "level": "error",
  "service": "trading-api",
  "environment": "development",
  "event": "http.request.failed",
  "message": "Can't reach database server",
  "requestId": "3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b",
  "errorCategory": "INTERNAL_ERROR",
  "errorName": "PrismaClientInitializationError",
  "durationMs": 42
}
```

Stack traces are logged with every internal error (ADR-009 point 6). They go to the server log only and never reach the response (§12.1).

Production logging must balance diagnostic usefulness with information exposure.

What each field gives today and in B3:

| Field | Today (`request.failed`, §1) | B3 |
| --- | --- | --- |
| `level`, `event`, `requestId` | Written | Kept; `event` is renamed `http.request.failed` (ADR-009 point 6); `requestId` added automatically (ADR-009 point 5) |
| `errorName` | Written | Kept on this line only, next to the stack (ADR-009 point 3) |
| raw error `message` | Written, unfiltered | Kept, unfiltered in v1 (ADR-009 point 4) |
| `timestamp`, `service`, `environment`, `durationMs`, `errorCategory` | Not written | Added (ADR-009 point 3); `errorCategory` is the `AppErrorCode` value |
| stack trace | Not written | Added for internal errors (ADR-009 point 6) |
| `jobId`, `connectionId` | n/a | Added in B4 and B5 (ADR-009 point 5) |

Code vs ADR:

- The example previously showed `operationId`, `errorCode: "DATABASE_ERROR"` and `source`. ADR-009 has no generic `operationId` (§10), names the error field `errorCategory`, and has no `DATABASE_ERROR` code: an unreachable database is `INTERNAL_ERROR` today and `DEPENDENCY_ERROR` from B0 (§12.2). `source` is not adopted in v1 (§7). The example `message` is illustrative: it is the raw error message, unfiltered in v1 (§11).
- The example `requestId` is a UUID: a client value with `_`, such as `req_123`, fails the `^[a-zA-Z0-9-]{1,64}$` check and is replaced (§9).
- ADR-009 point 6 sets no environment condition for stack traces. "Production" is the local production-like run (ADR-006 points 1 and 8); its logs stay on the developer's machine.

---

# 14. Frontend Error Observability

**Status:** `Planned (FE)` (ADR-009 point 12)

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

Code vs ADR:

- `apps/web` holds only a wireframe today; there is no frontend code to observe.
- The abstraction is the `Logger` port of ADR-009 point 1. In demo mode application code logs through the browser-console adapter. How the UI layer of the real-mode web app reports unexpected errors is decided in the frontend stage (ADR-009 point 12).
- Expected errors are told apart by the stable error `code` of the API (`07-api-spec.md` §5-6). The client shows a localized message mapped from the `code` (ADR-010 point 8), and can show the `requestId` of the error body (§9).
- Some sources have a decided user-facing outcome: a lost realtime connection shows a stale-data indicator and falls back to HTTP polling (ADR-007 point 12); a failed or timed-out CSV import creates an `ERROR` notification (ADR-008 point 6). Neither is an unexpected application error.
- There is no paid or hosted error-tracking service (ADR-006, §5).

---

# 15. Error Boundaries

**Status:** `Planned (FE)` (ADR-009 point 12)

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

Code vs ADR:

- The list of boundaries is a starting point; the frontend stage fixes it against the views of `11-ui-ux-spec.md`. The Activity view is `Deferred` (ADR-010 point 9), and "background job panels" means the CSV import status (ADR-008).
- The only identifier a boundary can show is a `requestId` from an API error body (§9). There is no generic operation identifier (§10); a job is identified by its `jobId` (ADR-008 point 9).
- Component tests for boundaries depend on the frontend test tooling, `Deferred` to the frontend-stage ADR (ADR-006 point 11).

---

# 16. Metrics Strategy

**Status:** `Deferred` (ADR-009 point 10)

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

ADR-009 point 10 defers all metrics: no metrics library and no `/metrics` endpoint until something consumes them (NFR-070). Under ADR-006 the backend runs locally only, so nothing would. Hosting the backend later (ADR-006 point 2) reopens the decision. §17-20 describe what a later metrics decision would start from; nothing in them is built in version 1.

Version 1 answers the same questions with log events and health checks:

| Area | Version 1 mechanism | Status |
| --- | --- | --- |
| Request behavior, errors, duration | `http.request.completed` with `durationMs`; error logs by category; slow-request `warn` (§6-8) | `Planned (B3)` (ADR-009 points 2, 6 and 8) |
| Database health | `GET /health/ready` (§22-23) | `Implemented` |
| Realtime behavior | Connection lifecycle log events (§8) | `Planned (B5)` (ADR-009 point 11) |
| Background jobs | Job transition log events (§8) | `Planned (B4)` (ADR-009 point 11) |
| Demo simulations | Browser-console adapter (ADR-009 point 1) | `Planned (FE)` |
| Performance | §25-27 | Per section |

---

# 17. HTTP Metrics

**Status:** `Deferred` (ADR-009 point 10)

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

In version 1 each request produces one `http.request.completed` log entry with its status and `durationMs` (ADR-009 points 2-3, `Planned (B3)`); totals and distributions can be read from those lines. Whether that entry records the route template or the raw URL, which can carry identifiers and query strings, is an open detail (B3).

---

# 18. Application Metrics

**Status:** `Deferred` (ADR-009 point 10); the rule against fabricated values is `Reference`

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

Code vs ADR: the version 1 counterpart of these counters is the event stream of §8. Portfolio, transaction and analytics event names are defined with each feature (ADR-009, Consequences). The only job type is the CSV import (ADR-008 point 1).

---

# 19. Realtime Metrics

**Status:** `Deferred` (ADR-009 point 10); connection lifecycle logging `Planned (B5)` (ADR-009 point 11)

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

Code vs ADR:

- No realtime server exists yet (ADR-007, `Planned (B5)`).
- In version 1 the server logs connection events with a `connectionId` (ADR-009 points 5 and 11): connect, authenticate and close. Event names and per-event logging are open in `08-realtime-spec.md` §58 (§8).
- Close codes make closures diagnosable without counters: `4001` unauthenticated or invalid token, `4002` token expired, `4008` limit exceeded, `1001` server going away (ADR-007 point 15).
- Reconnect attempts happen in the client (ADR-007 point 12); the server only sees new connections.

---

# 20. Background Job Metrics

**Status:** `Deferred` (ADR-009 point 10); job transition logging `Planned (B4)` (ADR-009 point 11)

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

Code vs ADR:

- The job states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` and `TIMED_OUT` (ADR-008 point 3). "Started" is the move to `PROCESSING`. Progress is a field (`processed`, `total`), not a state, so "progressed" is not a lifecycle step.
- A failed job carries a reason: `VALIDATION_FAILED`, `INTERRUPTED`, `APPLY_ERROR` or `APPLY_REJECTED` (ADR-008 points 5-6), and a retried job increments `attempt`. Job transition log entries carry the `jobId` (ADR-009 point 5); which of these fields they include is an open detail (B4).
- The demo runs the same use case in process, with simulated progress and injectable failures (ADR-008 point 13); its specifics wait for the frontend-stage demo ADR (ADR-010 point 6).

---

# 21. Database Observability

**Status:** per capability (table below)

The PostgreSQL integration should provide basic visibility into database health.

The system should be able to determine:

- whether a database connection can be established
- whether a lightweight query succeeds
- whether the connection pool is functioning
- whether a repository operation fails
- whether database operations are unexpectedly slow

Database logs should not include unrestricted SQL or sensitive parameters in normal operation.

Development diagnostics may expose more detail when explicitly enabled.

| Capability | Mechanism | Status |
| --- | --- | --- |
| Connection can be established; a lightweight query succeeds | `GET /health/ready` runs `SELECT 1` through the shared Prisma client (`apps/api/src/services/health.service.ts`) | `Implemented` |
| Connection pool functioning | No separate check; Prisma's default pool, observed through readiness and failed queries | Not decided |
| A repository operation fails | `request.failed` line today (§12.1), `http.request.failed` in B3 (ADR-009 point 6); 503 `DEPENDENCY_ERROR` for an unreachable database, logged at `error` with the stack | `Implemented` / `Planned (B0)` (ADR-002 point 10) / `Planned (B3)` |
| Unexpectedly slow database operations | Individual database operations are not timed in v1; only requests and the analytics series reconstruction are (ADR-009 point 8) | `Deferred` (ADR-009 point 8, Deferred detail) |
| No unrestricted SQL in logs | The Prisma client is created without a `log` option (`packages/database/src/client.ts`), so no query is logged | `Implemented` |

Code vs ADR: no switch enables more detailed database diagnostics. `LOG_LEVEL=debug` in development (ADR-009 point 7) controls application log entries, not Prisma query logging. Database operations are not timed and Prisma query logging is not enabled in v1 (ADR-009 point 8, amended 2026-10-07). `Deferred`.

---

# 22. Health Checks

**Status:** `Implemented` (`apps/api/src/routes/health.ts`, NFR-051, `07-api-spec.md` §30); route test `Planned (B0)` (ADR-001 point 8)

The backend must expose health endpoints.

At minimum:

```text
GET /health
```

and preferably a dependency-aware endpoint such as:

```text
GET /health/ready
```

The names are final: `GET /health` (liveness) and `GET /health/ready` (readiness), defined in `07-api-spec.md` §30.

What exists:

- Both routes sit outside `/api/v1`, need no token and do not use the `data` envelope (`07-api-spec.md` §30).
- They are registered after `helmet`, `cors` and the `requestId` middleware, and before the rate limiter and the body parser (`apps/api/src/app.ts`), so they are never rate-limited (NFR-051).
- `GET /` also answers `{ "service": "trading-api", "status": "ok" }`. It is an operational route (`07-api-spec.md` §3) but sits after the rate limiter and is not a health check.

Code vs ADR:

- NFR-051 measures health with route tests, including readiness with the database down. No test file covers `/health` or `/health/ready` today (`apps/api/src/routes`). The B0 route-test set includes a health route test covering `GET /health` and `GET /health/ready` (ADR-001 point 8, amended 2026-10-07; ADR-009 point 13). `Planned (B0)`.
- ADR-009 point 10 keeps both endpoints as the version 1 health signal while metrics are `Deferred`.

---

# 23. Liveness vs Readiness

**Status:** `Implemented` (`apps/api/src/controllers/health.controller.ts`); readiness 503 during graceful shutdown `Planned (B3)` (ADR-006 point 12)

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

Responses (`07-api-spec.md` §30):

| Endpoint | Check | Success | Failure |
| --- | --- | --- | --- |
| `GET /health` | None | 200 `{ "status": "ok", "service": "trading-api", "timestamp": "..." }` | None; always 200 while the process answers |
| `GET /health/ready` | `SELECT 1` against the database | 200 with `"status": "ok"` and `"checks": { "database": "ok" }` | 503 with `"status": "unavailable"` and `"checks": { "database": "unavailable" }`, plus one `health.database.unavailable` log line (§1) |

Both bodies carry an ISO 8601 `timestamp`. There is no "degraded" state: the only dependency is the database (NFR-051).

The response schema should remain stable and machine-readable.

Code vs ADR:

- Readiness checks the database only. "Required internal services" have no counterpart yet: the job runner (ADR-008, B4) and the market simulator (ADR-007, B5) run in process, and no ADR adds them to readiness. "Critical configuration" is checked once at startup instead: `apps/api/src/config/env.ts` validates the environment and the process exits on invalid values, so a running process always has valid configuration.
- The `health.database.unavailable` line logs `errorName` only, never the driver message or connection string (§24).
- Graceful shutdown is decided (ADR-006 point 12, added 2026-10-07; `14-deployment-spec.md` §16 requires it). `apps/api/src/index.ts` only calls `app.listen` and handles no shutdown signal today. On `SIGTERM` or `SIGINT` the server stops accepting connections, `GET /health/ready` returns 503 while the API is shutting down, in-flight requests drain with a timeout of 10 seconds, and Prisma is closed. The shutdown logs `app.shutdown.started` and `app.shutdown.completed` (ADR-009 point 11). `Planned (B3)`. No decision fixes the level of the shutdown entries; open detail (B3).

---

# 24. Health Check Security

**Status:** `Implemented` (NFR-051, `09-security-spec.md` §28)

Health endpoints must not expose:

- credentials
- connection strings
- environment secrets
- internal topology
- database error details
- sensitive configuration

Detailed diagnostics should remain development-only.

What exists: both bodies hold only `status`, the fixed `service` name, `timestamp` and, for readiness, `checks.database` as `ok` or `unavailable` (§23). A database failure is reduced to `unavailable`; its error name goes to the server log only. The health routes run after `helmet`, so they carry the same security headers as every response.

Code vs ADR: no detailed diagnostic mode exists in any environment, and no ADR plans one. Health routes need no token; this is acceptable because they expose nothing beyond the fields above and the backend runs locally only (ADR-006 point 2).

---

# 25. Performance Observability

**Status:** per operation (table below); performance metrics `Deferred` (ADR-009 point 10)

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

In version 1 a measurement is a log entry with `durationMs` (ADR-009 point 3), not a metric:

| Operation | Measurement | Status |
| --- | --- | --- |
| API request duration | `durationMs` on `http.request.completed`; `warn` above a configurable threshold, `SLOW_REQUEST_THRESHOLD_MS`, default 500 ms | `Planned (B3)` (ADR-009 points 2-3 and 8) |
| Analytics calculation | The reconstruction of the analytics series (ADR-004) is timed separately | `Planned (B3)` (ADR-009 point 8) |
| Database operation duration | None; individual database operations are not timed in v1 (ADR-009 point 8) | `Deferred` (§21) |
| Background job duration | Job transition log entries (ADR-009 point 11); whether they carry a duration is an open detail | `Planned (B4)` |
| Realtime event processing duration | None in ADR-007 or ADR-009 | Not decided; open detail of `08-realtime-spec.md` §58 (B5) |
| Frontend route, load, table and chart timing | §27 | `Planned (FE)` |

Today nothing is timed: no log line carries `durationMs`.

---

# 26. Timing Instrumentation

**Status:** request timing `Planned (B3)` (ADR-009 points 2 and 8); the shape of a generic timer is an open detail (B3)

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

Code vs ADR:

- Request timing needs no hand-written timer: `pino-http` records the duration of every request (ADR-009 point 2), and the slow-request `warn` builds on it (point 8).
- The analytics series reconstruction is the one non-request operation ADR-009 times (point 8). Whether it uses a shared timer helper or measures inline is an open detail (B3).
- Application code that measures time reads it from the `Clock` port (ADR-001 point 8, `Planned (B0)`), so tests can control durations; any timer helper follows the same rule.
- A timer that writes a log entry goes through the `Logger` port (ADR-009 point 1), so the same code runs in the API and in the demo.

---

# 27. Frontend Performance Diagnostics

**Status:** `Planned (FE)` (ADR-009 point 12)

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

Code vs ADR:

- No frontend code exists yet (§14). The list above is a starting point for the frontend-stage checklist (ADR-009 point 12).
- The public demo is a static production build with no backend (ADR-006 points 1 and 7), so development diagnostics must be off in it.
- Realtime update frequency is bounded on the server side: the simulator ticks every 1 second (ADR-007 point 15).
- "Background operation progress" is the CSV import progress (`processed`, `total`) delivered by `JOB_PROGRESS_UPDATED` (ADR-008 points 3 and 11).

---

# 28. Realtime Debugging

**Status:** server connection logging `Planned (B5)` (ADR-009 point 11, `08-realtime-spec.md` §58); client diagnostics `Planned (FE)`; a development realtime debug mode `Deferred` to the frontend-stage ADR (ADR-009 point 12)

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
[realtime] subscribed: market:{assetId}
[realtime] event received: MARKET_PRICE_UPDATED (sequence 42)
[realtime] event applied
```

Sensitive payload data should not be dumped indiscriminately.

A development-only debug mode may show sanitized payload summaries.

The list above mixes protocol messages, client states and log entries. What each item is in version 1:

| Item | Version 1 counterpart | Status |
| --- | --- | --- |
| `CONNECT`, `DISCONNECT`, `RECONNECT` | Client connection states `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `FAILED` (`08-realtime-spec.md` §6); server connect and close log entries with a `connectionId` | Client `Planned (FE)`; server `Planned (B5)` |
| `SUBSCRIBE` | Client message `SUBSCRIBE` (also `AUTHENTICATE`, `UNSUBSCRIBE`), answered by `ACK` or `ERROR` (ADR-007 point 15); a refused subscription is logged as `authz.denied` | `Planned (B5)` |
| `ERROR` | `ERROR` reply with a `code`, or a close code `4001`, `4002`, `4008`, `1001` (ADR-007 point 15) | `Planned (B5)` |
| `SYNC` | Resynchronization through HTTP after a gap, a reconnect or an epoch change (ADR-007 point 5, `08-realtime-spec.md` §26) | `Planned (FE)` |
| `EVENT_RECEIVED`, `EVENT_APPLIED` | Client-side processing; the client counts dropped (invalid) events (`08-realtime-spec.md` §58) | `Planned (FE)` |

Code vs ADR:

- No realtime code exists: no `ws` dependency and no socket server in `apps/api` (ADR-007, `Planned (B5)`).
- The example previously showed `price.updated`. Wire event types are `MARKET_PRICE_UPDATED`, `PORTFOLIO_UPDATED`, `NOTIFICATION_CREATED`, `ALERT_TRIGGERED` and the three job events `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED`, `JOB_FAILED` (ADR-007 point 6, ADR-008 point 11). They are a different namespace from log event names (§8).
- Server log event names and the level of per-event entries are open in `08-realtime-spec.md` §58 (B5), so continuous ticks (one per second, ADR-007 point 15) do not flood `info` logs.
- The access token of an `AUTHENTICATE` message and payloads with user data are never logged (ADR-009 point 4 and Deferred detail, `08-realtime-spec.md` §58). The envelope `id` identifies an event in logs and diagnostics (`08-realtime-spec.md` §47).
- A development-only realtime debug mode or diagnostics panel with payload summaries is deferred to the frontend-stage ADR (ADR-009 point 12, amended 2026-10-07). `Deferred`.

---

# 29. Demo Mode Observability

**Status:** `Planned (FE)` (ADR-009 points 1 and 12); demo event names `Deferred` with the demo specifics (ADR-010 point 6)

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

Code vs ADR:

- "The same observability architecture" is the `Logger` port (ADR-009 point 1): application code logs the same way, and the demo supplies a browser-console adapter. The demo has no backend (ADR-006 point 7), so its entries go to the browser console, not to stdout.
- Latency, failure injection, network changes and reset are demo specifics, `Deferred` to the frontend-stage demo ADR (ADR-010 point 6). The `demo.*` names above wait for that ADR (§8).
- The demo runs the same use cases in process: realtime through an in-process adapter fed by `@trading/market-sim` (ADR-007 point 13), the CSV import with simulated progress (ADR-008 point 13). Whether those emit `demo.realtime.*` and `demo.job.*` or the same `realtime.*` and `job.*` names as the API is an open detail (FE).
- The mode is selected by `APP_MODE=demo`, exposed to the web build as `VITE_APP_MODE` (ADR-006 point 8, `Planned (FE)`).

---

# 30. Simulation Diagnostics

**Status:** `Planned (FE)`; the diagnostics interface and most items `Deferred` with the demo specifics (ADR-010 point 6)

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

What each item is in version 1:

| Item | Version 1 counterpart | Status |
| --- | --- | --- |
| Current scenario | Scenario wire IDs `STABLE_MARKET`, `BULLISH_SESSION`, `VOLATILE_SESSION`, `SHARP_DRAWDOWN`, `RECOVERY` (ADR-007 point 15) | Engine `Planned (B5)`; demo scenario control `Deferred` |
| Simulation mode | Mode wire IDs `PAUSED`, `NORMAL`, `VOLATILE`, `BULLISH`, `BEARISH` (ADR-007 point 15) | Engine `Planned (B5)` |
| Realtime simulation state | Real-mode lifecycle `RUNNING <-> HALTED`; `PAUSED` is only a mode ID (ADR-007 point 16, `08-realtime-spec.md` §40) | `Planned (B5)`; demo lifecycle `Deferred` |
| Deterministic seed | Always present: the engine is seeded (ADR-007 point 7) | `Planned (B5)` |
| Latency and failure profiles | Demo specifics (ADR-010 point 6) | `Deferred` |
| Background jobs | The CSV import job and its state (ADR-008 points 3 and 13) | `Planned (FE)` |
| Persistence state | Namespaced browser storage (ADR-006 point 7) | `Planned (FE)` |

Code vs ADR:

- `@trading/market-sim` does not exist yet (ADR-007 point 7, B5); the API and the demo will share it.
- An explicit demo diagnostics interface is deferred to the demo ADR (ADR-009 point 12, amended 2026-10-07; ADR-010 point 6); `12-demo-mode-spec.md` §75 lists the same items as optional. `Deferred`.

---

# 31. Local Observability

**Status:** per item (table below); the local-only principle is `Reference` (ADR-006 points 1-2)

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

The tooling is decided: `pino` JSON lines on the API's stdout, `pino-pretty` in development (ADR-009 points 2-3), the two health endpoints, and the browser developer tools.

| Item | Mechanism | Status |
| --- | --- | --- |
| Request IDs in logs | `requestId` on every log line of a request (ADR-009 point 5) | `Planned (B3)`; added by hand to two lines today (§9) |
| Error events | Category logging (ADR-009 point 6) | `Planned (B3)` as `http.request.failed` and category entries; `request.failed` line today (§1) |
| Realtime events | Connection lifecycle entries (§28) | `Planned (B5)` |
| Background jobs | Job transition entries (§20) | `Planned (B4)` |
| Demo simulations | Browser-console adapter (§29), not the API logs | `Planned (FE)` |
| Health: API, Database | `GET /health`, `GET /health/ready` (§22-23) | `Implemented` |
| Development diagnostics | Browser console, network panel, application diagnostics (§39-40) | `Planned (FE)` |

Code vs ADR: logs are read where the API process runs: the terminal in development, or the container output under the Docker Compose `full` profile (ADR-006 point 4, `Planned (B7)`). There are no log files (ADR-009 point 3).

---

# 32. No Paid Observability Dependency

**Status:** `Reference` (ADR-006 points 1-2, ADR-009); met today: no observability vendor SDK in any `package.json`

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

Code vs ADR:

- The only planned observability dependencies are `pino`, `pino-http` and `pino-pretty` (ADR-009 point 2), all free and local; none is installed yet (§6.1).
- None of the integrations above is planned. Hosting the backend later (ADR-006 point 2) reopens metrics (ADR-009 point 10); any provider would then be a new adapter of the `Logger` port (§33). OpenTelemetry is covered in §34.

---

# 33. Provider-Agnostic Observability

**Status:** `Logger` port `Planned (B3)` (ADR-009 point 1); metrics and spans `Deferred`

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

Code vs ADR:

- The decided interface is a `Logger` port in `@trading/application` (ADR-009 point 1), with a `pino` adapter in the API and a browser-console adapter in the demo. `@trading/application` is created in B0 (ADR-001 point 1); its method signatures are an open detail (B3).
- `metric` has no counterpart: metrics are `Deferred` (ADR-009 point 10), so "Local Metrics" is not built.
- `error` is not a separate channel: errors are log entries at a level set by category, with the stack for internal errors (ADR-009 point 6).
- `startSpan` has no counterpart: tracing is not planned (§35).
- "Future Provider Adapter" would be another `Logger` adapter (§32).
- `@trading/domain` takes no logger (§4).

---

# 34. OpenTelemetry Consideration

**Status:** `Deferred` (no ADR adopts it; ADR-009 point 10 defers metrics)

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

Code vs ADR: no package depends on OpenTelemetry, and ADR-009 does not plan it. Version 1 keeps one JSON line per event with dotted `event` names and correlation identifiers (ADR-009 points 3 and 5), which a later exporter could map. Adopting it needs a new decision, like hosting the backend (ADR-006 point 2).

---

# 35. Tracing Strategy

**Status:** distributed tracing `Deferred`; trace-compatible fields per item (table below)

Distributed tracing is not a mandatory initial feature because the project is primarily a single application architecture.

However, trace-compatible concepts should be preserved:

- request ID
- operation ID
- parent/child operation relationships
- duration
- service/module boundaries

This allows future distributed tracing to be introduced without changing domain behavior.

| Concept | Version 1 counterpart | Status |
| --- | --- | --- |
| Request ID | `requestId` (§9) | `Implemented`; in every log line `Planned (B3)` |
| Operation ID | `jobId`, `connectionId`; no generic `operationId` (§10) | `Planned (B4)`, `Planned (B5)`; `operationId` `Deferred` |
| Parent/child relationships | None decided. Whether a job's log entries also carry the `requestId` of the request that created it is an open detail (B4) | Not decided |
| Duration | `durationMs` (ADR-009 point 3, §26) | `Planned (B3)` |
| Service/module boundaries | `service` is adopted; `source` and `module` are not adopted in v1 (ADR-009 point 3, §7) | `service` `Planned (B3)`; `source`, `module` not adopted |

The API is a single process: the job runner and the simulator run inside it (ADR-008 point 4, ADR-007), so there is no cross-service hop to trace.

---

# 36. Debugging Workflow

**Status:** `Reference`; step 3 depends on `requestId` in every log line, `Planned (B3)` (ADR-009 point 5)

The system should support a predictable debugging workflow.

### Step 1 — Identify the symptom

Example:

> Portfolio update failed.

### Step 2 — Capture request/operation ID

Example:

```text
requestId: 3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b
```

### Step 3 — Search logs

Find events associated with:

```text
3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b
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

Code vs ADR:

- Step 2: the `requestId` is in the `X-Request-ID` response header and in every error body (§9). The example previously showed `req_123`, which fails the `^[a-zA-Z0-9-]{1,64}$` check and would be replaced (§9). Asynchronous work has no operation ID: use the `jobId` or `connectionId` (§10).
- Step 3: logs are JSON lines on the API's stdout (ADR-009 point 3), filtered by the `requestId` field. Today only the `request.failed` and `health.database.unavailable` lines carry it (§1).
- Step 4: there is no application service layer yet; services call Prisma repositories directly until B0 (ADR-001, §4).
- Step 5: the logged category is `errorCategory` (ADR-009 point 3), and the client sees an `AppErrorCode` (§12.2): validation is `VALIDATION_ERROR`, authentication `UNAUTHORIZED`, authorization `FORBIDDEN`, an unreachable database `DEPENDENCY_ERROR` (`Planned (B0)`), and unexpected failures `INTERNAL_ERROR`. "Domain" and "database" are not separate codes (§12.2).
- Step 7: more detailed logging is `LOG_LEVEL=debug`, already the development default (ADR-009 point 7, §38).
- Step 8: a job is retried only on request (ADR-008 point 6); a realtime client reconnects with backoff and resynchronizes through HTTP (`08-realtime-spec.md` §26-27). "Rollback" means a database transaction that does not commit, such as the atomic apply stage of the CSV import (ADR-008 point 2); deployments are forward-fix only (ADR-006 point 6).

---

# 37. Debug Context

**Status:** `Planned (B3)` (ADR-009 points 3 and 5)

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

Code vs ADR:

| Field above | ADR-009 counterpart |
| --- | --- |
| `requestId`, `event` | Same name (point 3) |
| `duration` | `durationMs` (point 3) |
| `operationId` | `jobId` or `connectionId` (point 5, §10) |
| `errorCode` | `errorCategory` (point 3, §7) |
| `status` | The response status of the request log entry (§17) |
| `module`, `resource` | Not adopted in v1 (`module`, `resourceType` and `resourceId`, point 3, §7) |

Function entry and exit messages have no level of their own: `TRACE` is not used (§6.2), and `debug` is the most detailed level.

---

# 38. Logging Configuration

**Status:** `Planned (B3)` (ADR-009 points 2-4, 6-7); `LOG_LEVEL` not in `apps/api/src/config/env.ts` yet

Logging should be configurable by environment.

Decided configuration (`development`, `test` and local `production`, ADR-006 point 8):

| Setting | `development` | `test` | `production` |
| --- | --- | --- | --- |
| `LOG_LEVEL` (point 7) | `debug` | `silent`; integration tests that assert log content inject a capturing logger at `info` (Deferred detail) | `info` |
| Output (points 2-3) | `pino-pretty` | JSON lines | JSON lines on stdout |
| Stack traces (point 6) | For internal errors | For internal errors | For internal errors |
| Redaction (point 4) | On | On | On |

Code vs ADR:

- The previous text set `test` to `warn/error` with "deterministic output"; ADR-009 point 7 sets `silent`.
- Stack traces are not a development-only setting: ADR-009 point 6 logs them for every internal error, never in the response (§13).
- Redaction is not production-only: the fixed list of ADR-009 point 4 applies everywhere and is enforced by tests.
- `LOG_LEVEL` is the only logging-format or verbosity variable. The format follows the environment, and `LOG_FORMAT`, `ENABLE_DEBUG_LOGGING` and `ENABLE_DEV_DIAGNOSTICS` are not adopted (ADR-009 points 2 and 7; §68). The slow-request threshold has its own variable, `SLOW_REQUEST_THRESHOLD_MS` (ADR-009 point 8, §52).
- `apps/api/src/config/env.ts` validates `NODE_ENV` (`development`, `test`, `production`) but has no `LOG_LEVEL` today. Whether `LOG_LEVEL` is validated there like the other keys, and whether its default follows `NODE_ENV`, is an open detail (B3). `04-tech-stack.md` and `14-deployment-spec.md` already list the variable.

---

# 39. Development Diagnostic Mode

**Status:** `Deferred` to the frontend-stage ADR (ADR-009 point 12); its data sources are `Planned (FE)` or `Deferred` (below)

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

Code vs ADR: a development diagnostic mode or diagnostics panel is deferred to the frontend-stage ADR (ADR-009 point 12, amended 2026-10-07), and `ENABLE_DEV_DIAGNOSTICS` is not adopted (ADR-009 point 2). No frontend code exists. Where each item would come from:

| Item | Source | Status |
| --- | --- | --- |
| Request IDs | `requestId` in error bodies; `X-Request-ID` header (§9) | `Implemented` (API) |
| API timings | §27 | `Planned (FE)` |
| Realtime connection status | Always visible in the status bar, not development-only (FR-046, `08-realtime-spec.md` §28) | `Planned (FE)` |
| Active subscriptions | Realtime client diagnostics (`08-realtime-spec.md` §58) | `Planned (FE)` |
| Background job state | The CSV import job's HTTP status and job events (ADR-008 points 9 and 11) | `Planned (B4)` / `Planned (FE)` |
| Demo simulation and failure injection state | Demo specifics (ADR-010 point 6, §30) | `Deferred` |
| Cache/query diagnostics | The server-state library is not chosen (§42) | `Deferred` |

The public demo is a static production build (ADR-006 points 1 and 7), so any such mode must be off there (§27).

---

# 40. Browser Diagnostics

**Status:** `Planned (FE)` (ADR-009 point 12)

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

Code vs ADR:

- Console: the demo logs through the browser-console `Logger` adapter (ADR-009 point 1). How the real-mode web app reports unexpected errors is decided in the frontend stage (§14). Realtime lifecycle entries "in debug mode" depend on the debug mode of §28 and §39, which is deferred to the frontend-stage ADR (ADR-009 point 12).
- Network: the panel shows `X-Request-ID` on every API response. Today page code can read it only from error bodies, because `cors` does not expose the header; B3 exposes it through CORS (ADR-009 point 5, §9). WebSocket messages appear there too; an `AUTHENTICATE` message carries the access token (ADR-007 point 2).
- Application: the demo keeps its state in namespaced browser storage (ADR-006 point 7); storage versioning is a demo specific (`Deferred`, ADR-010 point 6). The access token is kept in memory only, never in browser storage, and the refresh token is an `HttpOnly` cookie that page code cannot read (ADR-005).

---

# 41. Observability and State Management

**Status:** `Planned (FE)`; the client-state library is not chosen (`Deferred`, `08-realtime-spec.md` §34)

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

Code vs ADR:

- No ADR selects Zustand; the client-state library is chosen in a frontend-stage decision (`04-tech-stack.md`, `08-realtime-spec.md` §34). The rule above applies to whichever store is chosen.
- The "Observability service" is the `Logger` port (ADR-009 point 1). "Local metrics" are `Deferred` (ADR-009 point 10), and no exporter is planned (§32).
- Realtime client state (connection state, active subscriptions, last processed sequence and epoch per channel) is the one observability-related state the UI needs; it lives in the client-state store (`08-realtime-spec.md` §34) and drives the status bar (FR-046).

---

# 42. Observability and TanStack Query

**Status:** `Planned (FE)`; the server-state library is not chosen (`Deferred`, `08-realtime-spec.md` §33)

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

Code vs ADR:

- No ADR selects TanStack Query; the server-state cache library is chosen in a frontend-stage decision (`04-tech-stack.md`, `08-realtime-spec.md` §33). The list above applies to whichever library is chosen.
- Retries follow the HTTP client's retry policy, decided in the frontend-stage ADR (ADR-006 point 11). Invalidation is also driven by realtime events (`08-realtime-spec.md` §32-33).
- Which of these lifecycle events are logged, and at what level, is an open detail (FE). Payloads stay out of logs, in line with ADR-009 point 4.

---

# 43. Observability and Background Tasks

**Status:** `Planned (B4)` on the B3 `Logger` port (ADR-009 points 5 and 11, ADR-008); no job code exists today

Background operations must emit lifecycle events. The only job in version 1 is the CSV transaction import (ADR-008 point 1). Each log entry names the ADR-008 transition it records; the dotted names are working names until B4 (§8), except `job.failed`, which ADR-009 point 3 uses as an example.

Success:

```text
job.started      QUEUED -> PROCESSING
     │
     ▼
job.progress     processed/total updated (a field, not a state)
     │
     ▼
job.progress
     │
     ▼
job.completed    PROCESSING -> COMPLETED (set in the apply UnitOfWork)
```

Failure:

```text
job.started      QUEUED -> PROCESSING
     │
     ▼
job.progress
     │
     ▼
job.failed       PROCESSING -> FAILED, with a reason
```

Timeout (only while `QUEUED` or validating; the apply stage is exempt):

```text
job.started      QUEUED -> PROCESSING
     │
     ▼
job.timed_out    -> TIMED_OUT
```

Cancellation (only while `QUEUED` or validating; never during apply):

```text
job.started      QUEUED -> PROCESSING
     │
     ▼
job.cancelled    -> CANCELLED
```

These events correlate through `jobId` (ADR-009 point 5), not a generic `operationId` (§10).

| Transition | ADR-008 | Log entry | Realtime event |
| --- | --- | --- | --- |
| Created as `QUEUED` | points 3-4 | Name open (B4) | None |
| `QUEUED` -> `PROCESSING` | point 3 | `job.started` (working name) | None |
| Progress update | point 3 (`processed`, `total`) | `job.progress` (working name; level open, B4) | `JOB_PROGRESS_UPDATED` |
| -> `COMPLETED` | point 5 | `job.completed` (working name) | `JOB_COMPLETED` |
| -> `FAILED` | points 2, 5-6 | `job.failed` | `JOB_FAILED` |
| -> `CANCELLED` | point 6 | `job.cancelled` (working name) | None (ADR-007 point 15) |
| -> `TIMED_OUT` | point 7 | `job.timed_out` (working name) | None (ADR-007 point 15) |
| Retry: back to `QUEUED`, `attempt` + 1 | point 6 | Name open (B4) | None |
| Startup: `PROCESSING` -> `FAILED` (`INTERRUPTED`); `QUEUED` resumed | point 5 | Name open (B4); part of startup logging (ADR-009 point 11) | `JOB_FAILED` |

Code vs ADR:

- The six states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` and `TIMED_OUT` (ADR-008 point 3). There is no `started` or `progress` state; the log names above describe transitions, and realtime event types (`JOB_*`) are a separate namespace (§8).
- A `FAILED` entry carries its reason: `VALIDATION_FAILED`, `INTERRUPTED`, `APPLY_ERROR` or `APPLY_REJECTED` (ADR-008 points 5-6). Which other fields (`attempt`, `stage`, `userId`) each entry includes is an open detail (B4, §20).
- The job input (the stored CSV content) is never logged (ADR-009 Deferred detail).
- Under ADR-009 point 6, a job failure is not an HTTP error, so its level is not fixed there. Open detail (B4).

---

# 44. Observability and Security Events

**Status:** `Planned (B3)` (ADR-009 point 9, `09-security-spec.md` §50); refresh reuse event `Planned (B2)` with the refresh endpoint (ADR-005 point 5); `auth.logout` `Planned (B2)` with its endpoint (ADR-009 point 9)

Security-relevant events should be observable.

Events (ADR-009 point 9):

```text
auth.login.succeeded
auth.login.failed
auth.refresh.reuse_detected
auth.logout
authz.denied
```

These events should never log authentication secrets.

For failed authentication attempts, useful context may include:

- timestamp
- request ID
- route
- sanitized client context
- failure category

Avoid storing excessive identifying information.

The list previously used other names. What each became:

| Previous name | Version 1 | Status |
| --- | --- | --- |
| `auth.login.success` | `auth.login.succeeded` | `Planned (B3)` |
| `auth.login.failure` | `auth.login.failed`, same fields whatever the cause (`09-security-spec.md` §51) | `Planned (B3)` |
| `auth.logout` | `auth.logout`, at `info`, with `userId` only (ADR-009 point 9, amended 2026-10-07). `POST /api/v1/auth/logout` is `Planned (B2)` (ADR-005 point 6) | `Planned (B2)`, with the endpoint |
| `auth.token.refresh.failure` | Only reuse of a rotated refresh token has an event, `auth.refresh.reuse_detected` (ADR-005 point 5); other refresh failures have none (ADR-009 point 9) | `Planned (B2)` / `Planned (B3)` |
| `auth.authorization.denied` | `authz.denied` | `Planned (B3)`; on role checks from B2, on realtime subscriptions from B5 |

Code vs ADR:

- No security event is logged today: there is no logger (ADR-009, B3) and no refresh or logout endpoint (ADR-005, B2). Login failures are answered (`09-security-spec.md` §51) but not logged.
- Each event carries `timestamp`, `event`, `requestId` and `userId` when known (ADR-009 point 3, `09-security-spec.md` §50). Authentication failures log at `warn` (ADR-009 point 6). Passwords, the `Authorization` header, cookies and both tokens are never logged (ADR-009 point 4).
- `route` comes from the request log. ADR-009 lists no client address or user agent, so "sanitized client context" is an open detail (B3). Whether `auth.login.failed` records the cause (unknown email or wrong password) as a value is also open (B3); the fields stay the same for every cause.
- Refresh failures other than reuse (an expired, unknown or revoked token, a missing custom header) have no dedicated event; they are ordinary `401` request logs (ADR-009 point 9, amended 2026-10-07).
- Logout emits `auth.logout` at `info`, carrying `userId` only (ADR-009 point 9, amended 2026-10-07). `09-security-spec.md` §50, which left the event open, follows the ADR.

---

# 45. Audit vs Operational Logs

**Status:** `Reference`; version 1 has operational logs only (`Planned (B3)`) and no separate audit store (`09-security-spec.md` §50)

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

Code vs ADR:

- The security events of §44 are the version 1 trail for security-relevant actions; they live in the operational log, so they are as transient as it is (§46).
- Two audit examples have no counterpart in version 1: transactions are immutable, with no update or delete endpoint (ADR-003, `07-api-spec.md`), and roles come from the seed, with no role-change endpoint (ADR-005 point 10).
- User-visible activity (the Activity view, notifications) is a product feature, not an audit record and not an operational log (ADR-009 Context).
- "Websocket disconnected" is a realtime connection entry, `Planned (B5)` (§28).

---

# 46. Log Retention

**Status:** stdout only `Planned (B3)` (ADR-009 point 3); log files `Deferred`

Because the project is designed for local/free infrastructure, retention should remain simple.

Logs are one JSON line per event on stdout (ADR-009 point 3). The API writes no log file, so it never appends to an unbounded file and keeps no retention of its own. Retention belongs to whatever reads stdout: the developer's terminal, or the container output under the Docker Compose `full` profile (ADR-006 point 4, `Planned (B7)`).

Container environments treat stdout/stderr as the primary log stream.

Code vs ADR:

- Earlier drafts allowed writing local files and rotating them. ADR-009 point 3 rules out log files and rotation; there is no file option.
- Today the API writes through `console.log` and `console.error` (§1), which also go to stdout and stderr only.

---

# 47. Log Rotation

**Status:** removed by ADR-009 point 3 (no log files, no rotation); the heading stays so section numbers do not shift

The API writes no log file (§46), so there is nothing to rotate. If a hosted backend (ADR-006 point 2) ever needs file logs, a new decision reopens this section.

---

# 48. Metrics Storage

**Status:** `Deferred` (ADR-009 point 10); no metrics library and no in-memory counters exist

The initial metrics implementation should favor lightweight local mechanisms.

Possible approaches include:

- in-memory counters
- in-memory histograms
- development endpoint
- standard process metrics where appropriate

Metrics must not grow without bounds.

If an in-memory metric is used, its lifecycle should be clearly defined.

Code vs ADR: ADR-009 point 10 defers metrics until something consumes them (NFR-070); the in-memory approach was considered and deferred (ADR-009 Alternatives). Durations are still recorded per request as `durationMs` on log entries (ADR-009 point 3, §26). These constraints apply when a hosted backend (ADR-006 point 2) reopens metrics.

---

# 49. Metrics Endpoint

**Status:** `Deferred` (ADR-009 point 10: no `/metrics` endpoint)

A development or internal metrics endpoint may be provided.

Conceptually:

```text
GET /metrics
```

The endpoint should be disabled, protected or restricted depending on deployment requirements.

It must not expose secrets or sensitive application state.

If Prometheus-compatible output is adopted, metric naming and label cardinality should follow Prometheus conventions.

Code vs ADR: `apps/api` registers no `/metrics` route; the only unauthenticated operational routes are `GET /health` and `GET /health/ready` (§22). A Prometheus stack was rejected for version 1 (ADR-009 Alternatives).

---

# 50. Process Metrics

**Status:** `Deferred` (ADR-009 point 10)

The backend may expose basic process measurements such as:

- process uptime
- memory usage
- CPU usage where available
- event-loop behavior where useful
- active connections

These are diagnostics, not promises of performance.

They should be used to identify issues rather than to create artificial benchmarks.

Code vs ADR:

- `GET /health` returns `status`, `service` and `timestamp`, not uptime or memory (`apps/api/src/controllers/health.controller.ts`).
- The server will count WebSocket connections per user to enforce the cap of 5 (ADR-005 point 13, ADR-007 point 16, `Planned (B5)`). That count is an enforcement limit, not an exposed metric.

---

# 51. Performance Baselines

**Status:** `Reference` (the rule against unmeasured results); recorded baselines `Deferred` with metrics (ADR-009 point 10)

The project may establish performance baselines during implementation.

Examples of measurements that could be established:

- API request duration distribution
- database query duration
- analytics calculation duration
- realtime processing duration
- frontend interaction timing

No baseline should be documented as a project result until it has actually been measured.

Code vs ADR: no baseline has been measured. From B3, request and analytics-series durations appear as `durationMs` in log entries (ADR-009 points 3 and 8), which is enough to measure by hand. Realtime processing is `Planned (B5)` and frontend timing `Planned (FE)` (§27).

---

# 52. Performance Thresholds

**Status:** slow-request threshold `Planned (B3)` (ADR-009 point 8); other thresholds not decided

Diagnostic thresholds may be configured to identify suspicious operations.

For example:

```text
if duration > diagnosticThreshold
    emit warning
```

Thresholds should be configurable.

They should not automatically be presented as user-facing SLA guarantees.

Code vs ADR:

- The one decided threshold is for HTTP requests: configurable through `SLOW_REQUEST_THRESHOLD_MS`, default 500 ms, for HTTP requests only (ADR-009 point 8, amended 2026-10-07). The variable is not in `apps/api/src/config/env.ts` yet; it is added in B3.
- The analytics series reconstruction is timed separately (ADR-009 point 8); because `SLOW_REQUEST_THRESHOLD_MS` covers HTTP requests only, whether the reconstruction has its own threshold is an open detail (B3, §26).
- Version 1 is local only (ADR-006), so there is no SLA.

---

# 53. Slow Operation Diagnostics

**Status:** `Planned (B3)` (ADR-009 points 3, 5 and 8); the entry's event name is an open detail (B3)

A slow operation should generate a useful diagnostic event.

Example (a request over the threshold):

```json
{
  "level": "warn",
  "event": "http.request.completed",
  "requestId": "6f1c2a9e-3b4d-4c1e-9a7f-2d8e5b0c4f11",
  "durationMs": 842
}
```

The threshold and exact fields should be implementation-configurable.

Code vs ADR:

- The example previously used `operation.slow` with `operationId` and `source`. Requests correlate by `requestId` (ADR-009 point 5); a generic `operationId` is `Deferred` (§10), and `source` is not an ADR-009 field (§7).
- ADR-009 point 8 asks for "a `warn` entry"; whether that is the request's own `http.request.completed` entry raised to `warn` (as above) or a separate event is an open detail (B3).

---

# 54. Observability Overhead

**Status:** `Reference`

Instrumentation must not significantly alter application behavior.

Avoid:

- serializing huge objects
- excessive console logging
- synchronous heavy log processing
- storing unlimited events in memory
- logging every realtime payload
- logging every render in normal development

The observability system itself should be observable if it becomes sufficiently complex.

How version 1 meets the list: logs go to stdout with no in-memory event store (ADR-009 point 3); payloads with user data and the CSV job input are never logged (ADR-009 point 4 and Deferred detail); `LOG_LEVEL` keeps `debug` out of production and tests (ADR-009 point 7). Render logging is a frontend concern (`Planned (FE)`, §27).

---

# 55. Realtime Event Sampling

**Status:** not decided (open detail, B5, `08-realtime-spec.md` §58); product processing of every event `Planned (B5)` / `Planned (FE)`

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

Code vs ADR: the simulator ticks once per second (ADR-007 point 15). No ADR adopts sampling. `08-realtime-spec.md` §58 leaves open the level of per-event entries so that ticks do not flood `info` logs; sampling and a `debug`-only level are both candidates for that B5 detail.

---

# 56. Demo Realtime Logging

**Status:** real-mode simulator entries `Planned (B5)` (ADR-009 point 11); demo logging `Planned (FE)` through the browser-console `Logger` adapter (ADR-009 point 1); demo event names `Deferred` with the demo specifics (ADR-010 point 6)

Demo mode should make simulated realtime behavior understandable without flooding the console.

Instead of logging every simulated price tick by default, log lifecycle events such as:

```text
simulation.started
simulation.paused
simulation.mode.changed
```

Detailed tick logging can be enabled explicitly for debugging.

What each name maps to in the simulator lifecycle (`RUNNING <-> HALTED`, ADR-007 points 15-16, `08-realtime-spec.md` §40):

| Name | Version 1 counterpart | Status |
| --- | --- | --- |
| `simulation.started` | `POST /api/v1/simulation/start`: `HALTED` -> `RUNNING` (ADR-009 point 11) | `Planned (B5)` |
| `simulation.paused` | `POST /api/v1/simulation/pause`: `RUNNING` -> `HALTED`. The name follows the endpoint, not the lifecycle state; it is unrelated to the `PAUSED` mode wire ID (ADR-009 point 11) | `Planned (B5)` |
| `simulation.mode.changed` | `PUT /api/v1/simulation/mode`; the name follows the endpoint (ADR-009 point 11, ADR-007 point 15) | `Planned (B5)` |
| `simulation.resumed` | No separate transition: `start` from `HALTED` is the resume, so the name is not adopted (ADR-009 point 11) | Not adopted |
| `simulation.stopped` | Real mode has no stop (ADR-007 point 15), so the name is not adopted for real mode; a demo stop or reset belongs to the demo ADR | Not adopted; demo stop `Deferred` (ADR-010 point 6) |
| `simulation.error` | No ADR defines simulator errors; deferred until they are defined (ADR-009 point 11, Deferred detail) | `Deferred` (B5) |

Code vs ADR:

- `@trading/market-sim` and the simulator do not exist yet (ADR-007, B5).
- A mode change (`PUT /api/v1/simulation/mode`) is logged as `simulation.mode.changed`. What the `PAUSED` mode does relative to `HALTED` is itself open (ADR-007 Deferred detail, B5).
- ADR-009 point 11 (amended 2026-10-07) names the real-mode simulator entries: `simulation.started`, `simulation.paused` and `simulation.mode.changed`. The level of these entries is not fixed by any decision; open detail (B5). The demo names wait for the frontend-stage demo ADR (§29).
- Per-tick logging follows §55.

---

# 57. Health Check Failure Behavior

**Status:** per item (table below)

If a dependency becomes unavailable:

- readiness should reflect the dependency state
- errors should be logged
- requests should receive appropriate error responses
- recovery should be observable
- the application should not crash unnecessarily

For demo mode, dependency failures may be simulated according to `12-demo-mode-spec.md`.

The only dependency is PostgreSQL.

| Item | Today | Status |
| --- | --- | --- |
| Readiness reflects the dependency | `GET /health/ready` returns 503 with `checks.database: "unavailable"` | `Implemented` (`apps/api/src/controllers/health.controller.ts`) |
| Errors are logged | Readiness writes one JSON line, `health.database.unavailable`, with `requestId` and `errorName`; other requests log `request.failed` (§1) | `Implemented` as `console` lines; on the `Logger` port `Planned (B3)` (`http.request.failed`, ADR-009 point 6) |
| Appropriate error responses | A request that fails because the database is unreachable gets 500 `INTERNAL_ERROR` | 503 `DEPENDENCY_ERROR` `Planned (B0)` (ADR-002 point 10, `07-api-spec.md`), logged at `error` with the stack `Planned (B3)` (ADR-009 point 6) |
| Recovery is observable | Readiness is checked on every call, so it returns 200 again once the database answers; no entry records the recovery | No recovery entry in v1 (ADR-009 point 11); `Deferred` until a poller exists (B7, §58) |
| No unnecessary crash | A failed query is handled per request by the error handler; there are no process-level handlers | Startup logging and graceful shutdown (ADR-006 point 12) with `app.shutdown.started` and `app.shutdown.completed` `Planned (B3)` (ADR-009 point 11) |
| Demo dependency failures | Simulated failures are a demo specific | `Deferred` (ADR-010 point 6) |

Code vs ADR: readiness answers 503 while the API is shutting down (ADR-006 point 12, `Planned (B3)`; §23).

---

# 58. Recovery Observability

**Status:** per item (table below); a database recovery entry `Deferred` until a poller exists (B7, ADR-009 point 11)

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

ADR-009 point 11 lists the lifecycle events of version 1: startup, graceful shutdown, job transitions and realtime connection events. It names no entry for recovery after a dependency failure, and the amended point 11 states that version 1 has no database recovery entry and no `dependency.recovered`, because there is one dependency. What each example is in version 1:

| Example | Counterpart in version 1 | Status |
| --- | --- | --- |
| `database.recovered` | Readiness is stateless: each `GET /health/ready` runs `SELECT 1` (`apps/api/src/services/health.service.ts`) and nothing remembers the previous answer. A recovery entry needs that memory, which is a poller: there is no entry in v1 (ADR-009 point 11 and Deferred detail) | `Deferred` (B7); reconsidered when the API healthcheck exists |
| `dependency.recovered` | PostgreSQL is the only dependency (§57), so this name would repeat `database.recovered` | Not adopted in v1 (ADR-009 point 11) |
| `realtime.reconnected` | For the server a reconnect is a new connection with a new `connectionId` (ADR-009 point 5), logged as a connection event (ADR-009 point 11); linking it to the earlier connection is not decided. The client exposes its reconnect attempts through its diagnostics (`08-realtime-spec.md` §58) | Server entry `Planned (B5)`; client diagnostics `Planned (FE)`; the name is not decided (`08-realtime-spec.md` §58) |
| `job.retry` | A retry sends the job back to `QUEUED` with `attempt` + 1, on request through `POST /api/v1/jobs/:jobId/retry` (ADR-008 points 6 and 9); no automatic retry is decided. It is a job transition, so ADR-009 point 11 covers it | Entry `Planned (B4)`; working name (§43) |
| Startup recovery of jobs (not in the list) | `PROCESSING` -> `FAILED` (`INTERRUPTED`) and `QUEUED` resumed on startup (ADR-008 point 5) | `Planned (B4)`; name open (§43) |
| `demo.failure.recovered` | Simulated failures are a demo specific | `Deferred` (ADR-010 point 6) |

Code vs ADR:

- No code emits any of these names; there is no logger yet (§1).
- The five names above were examples, not ADR names (§8). Only the job entries are covered by a decision in kind (ADR-009 point 11); their names are working names until B4 (§43).
- Recovery is implicit today: the failure lines stop and the next readiness call returns 200 (§57). No entry says that the database came back, and none is added in v1.
- A job's lifecycle can be followed through the entries that share its `jobId` (§10): `job.failed`, the retry entry, `job.started`, `job.completed`. Whether those entries carry `attempt` is open (§43, B4). For the database the failure-to-success chain stays incomplete in v1 by decision, and for a realtime connection until the name of the reconnect entry is decided (`08-realtime-spec.md` §58).
- A database recovery entry (and `dependency.recovered`) needs a poller, because readiness is stateless. It is reconsidered when the API healthcheck exists (B7; ADR-009 Deferred detail).

---

# 59. Observability Testing

**Status:** per group (table below)

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

Where each group stands:

| Group | Today | Status |
| --- | --- | --- |
| Logging | No logger and no log assertions | `Planned (B3)`: unit tests for redaction and event names, and an integration test that a request's `requestId` appears in its log entries, using a capturing logger at `info` (ADR-009 point 13 and Deferred detail) |
| Errors | Route tests assert error codes, and the 404 test asserts `requestId` in the body (`apps/api/src/app.test.ts`). No test covers the 500 `INTERNAL_ERROR` response, the `request.failed` line or the `X-Request-ID` header | Logging of unexpected errors by category `Planned (B3)` (ADR-009 point 6); ADR-009 point 13 does not name error-handler tests, so assigning them is an open detail (B3) |
| Metrics | None | `Deferred` (ADR-009 point 10) |
| Health | No test covers `GET /health` or `GET /health/ready` | `Planned (B0)` as a health route test in the B0 set (ADR-001 point 8, ADR-009 point 13; NFR-051, §22) |
| Realtime | None | Server `Planned (B5)`, client `Planned (FE)` (`08-realtime-spec.md` §59) |
| Demo | None | `Deferred` with the demo specifics, including failures and reset (ADR-010 point 6); tooling waits for the frontend-stage ADR (ADR-006 point 11) |

Code vs ADR:

- The tooling exists: Vitest and supertest run the `apps/api` route tests (`Implemented`).
- NFR-051 is `Implemented` but no test covers the health routes today. ADR-001 point 8 (amended 2026-10-07) adds a health route test, covering `GET /health` and `GET /health/ready`, to the B0 route-test set, and ADR-009 point 13 points to it. Reflecting it in the B0 scope of `BACKEND-ROADMAP.md` belongs to that document's alignment (T5.3).
- Under `NODE_ENV=test` the log level is `silent` (ADR-009 point 7), so a test that asserts log content injects its own capturing logger.
- "Metric labels remain bounded" is `Deferred` with the metrics; the cardinality rules of §71 apply if metrics are ever built.

---

# 60. Unit Tests for Observability

**Status:** per item (table below)

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

| Item | Version 1 counterpart | Status |
| --- | --- | --- |
| Logger adapters | The pino adapter in the API; the browser-console adapter in the demo (ADR-009 point 1) | API adapter `Planned (B3)`; demo adapter `Planned (FE)` |
| Event normalization | Tests of event names (ADR-009 point 13). No normalizer is decided; the check is that names follow the dotted convention (§8) | `Planned (B3)` |
| Error classification | The handler classifies today (`AppError`, body-parser errors, `Invalid*` and `Insufficient*` domain errors, everything else), without a dedicated test. Classification for logging is ADR-009 point 6 | Today `Implemented`, untested; logging by category `Planned (B3)`; application error mapping `Planned (B0)` (ADR-001 point 3) |
| Sensitive-data sanitization | Redaction paths, including the response `set-cookie` header and the WebSocket token (ADR-009 point 4 and Deferred detail) | `Planned (B3)` |
| Request ID generation | `apps/api/src/middleware/request-id.ts` has no test. The B3 integration test for `requestId` in log entries exercises it (ADR-009 point 13) | `Implemented`; test `Planned (B3)` |
| Metric counters | No metrics | `Deferred` (ADR-009 point 10) |
| Timing helpers | Request duration comes from `pino-http` (§26); the shape of a generic timer is open | `Planned (B3)`; shape open |
| Health-check aggregation | One dependency, so nothing aggregates (§57). The readiness handler is covered by the health route test of the B0 set (ADR-001 point 8, §59) | `Planned (B0)` as route tests |
| Demo observability events | Demo event names wait for the demo ADR (ADR-010 point 6) | `Deferred` |

Code vs ADR:

- Avoiding wall-clock timing follows ADR-001 point 8: one shared `Clock` port, injected through the composition root, with the simulator clock using the same port (`Planned (B0)`). Whether the request duration of the B3 logger reads that port is an open detail (B3).
- `GET /health` and `GET /health/ready` stamp their bodies with `new Date()` (`apps/api/src/controllers/health.controller.ts`). ADR-001 point 8 applies the `Clock` port to domain and application code, so the API controllers are outside its stated scope.

---

# 61. Integration Tests for Observability

**Status:** per example (table below)

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

| Example | Today | Status |
| --- | --- | --- |
| Successful request emits the expected event | Request logs do not exist | `http.request.completed` `Planned (B3)` (ADR-009 points 2-3 and 13) |
| Failed request includes the request ID | The response body carries it, asserted for the 404 case only. Log lines carry it only where the two `console` lines add it by hand | Response side `Implemented`; log side `Planned (B3)` (ADR-009 points 5 and 13) |
| Database failure produces the correct error classification | A database failure on a normal request returns 500 `INTERNAL_ERROR` | 503 `DEPENDENCY_ERROR` `Planned (B0)` (ADR-002 point 10); log classification `Planned (B3)` |
| Health endpoint reports the database state | Behavior `Implemented` (§23); no test | `Planned (B0)` as the health route test (ADR-001 point 8, §59) |

Code vs ADR:

- The existing route tests run through supertest against the Prisma path (ADR-001 point 7); the application services get in-memory fakes in B0. A test that makes the database fail needs an injectable failure: a fake repository that throws, or a stopped database. Which one the B0 and B3 tests use is an open detail.
- The flow in the diagram ends in `Log / Metric`. Version 1 has no metric (ADR-009 point 10), so the last step is a log entry.

---

# 62. E2E Observability Tests

**Status:** tooling `Deferred` to the frontend-stage ADR (ADR-006 point 11); the scenarios below `Planned (FE)` once it exists

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

Code vs ADR:

- No web app and no E2E tool exist. Playwright and the component test runner are chosen in the frontend-stage ADR (ADR-006 point 11); until then they stay `Deferred` and block nothing in B0-B7 (`10-testing-strategy.md` §53).
- The API half of the first scenario (an invalid transaction returns a validation error) is covered today by route tests that assert `VALIDATION_ERROR` (`apps/api/src/routes/transactions.routes.test.ts`); the UI half is `Planned (FE)`.
- The realtime scenario needs the server (`Planned (B5)`) and the client (`Planned (FE)`). The simulated disconnect is a client test that drops the socket through a transport test double (`08-realtime-spec.md` §42); a demo control for it is `Deferred` (ADR-010 point 6).
- "Traceable during development" depends on `requestId` reaching the log lines, `Planned (B3)`.

---

# 63. Observability in CI

**Status:** per check (table below); no CI workflow exists today

CI should validate that:

- tests pass
- linting passes
- type checking passes
- production builds succeed
- observability code does not introduce unsafe dependencies
- environment-specific logging configuration is valid

CI itself does not need a paid observability platform.

The decided workflow is one GitHub Actions workflow on pushes and pull requests to `develop` and `main`, with no continuous deployment (ADR-006 points 10-11, `10-testing-strategy.md` §53):

| Check | Version 1 | Status |
| --- | --- | --- |
| Tests pass | `pnpm test`: the domain, database and API suites, the latter two against a PostgreSQL service container | `Planned (B0)` |
| Linting passes | `pnpm lint` | `Planned (B0)` |
| Type checking passes | `pnpm typecheck` | `Planned (B0)` |
| Production builds succeed | `pnpm build` proves the packages compile from a clean checkout; running the built API is B7 (ADR-006 point 11) | `Planned (B0)` |
| Observability code adds no unsafe dependency | No audit or license step in v1 (ADR-009 point 2, NFR-070; ADR-006 points 10-11 define none). The dependencies are `pino`, `pino-http` and `pino-pretty` (ADR-009 point 2), installed from the lockfile | Not adopted in v1 |
| Logging configuration is valid | `apps/api/src/config/env.ts` validates the environment at startup and the process exits on invalid values; `LOG_LEVEL` joins it in B3 (§38). No dedicated CI step is decided | `Planned (B3)` |

Code vs ADR:

- The checks exist as local scripts in the root `package.json` (`typecheck`, `lint`, `test`, `build`, `format:check`), and the Husky pre-commit hook runs `lint-staged`. Nothing runs on a server today: `.github/` holds only `PULL_REQUEST_TEMPLATE.md`.
- ADR-006 point 11 also runs `pnpm format:check`, which this list does not mention.
- The workflow uses GitHub Actions only and needs no observability service, which matches the last sentence above (ADR-006 point 10).

---

# 64. Failure Injection

**Status:** demo failure injection `Deferred` (ADR-010 point 6); test fault injection `Planned (FE)` (`08-realtime-spec.md` §43); `http.request.failed` `Planned (B3)` (ADR-009 point 6); realtime event names not decided (below)

The demo system should reuse the observability infrastructure to make simulated failures visible.

Examples:

```text
API failure
   ↓
http.request.failed
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

Code vs ADR:

- "The same observability infrastructure" is the `Logger` port (ADR-009 point 1). The demo supplies the browser-console adapter, `Planned (FE)`.
- Scripted failures, latency and network changes are demo specifics, `Deferred` to the frontend-stage demo ADR (ADR-010 point 6). Faults in client tests are injected at the transport port; failure-injection code is demo-only or test-only and never reaches the API build (NFR-058, `08-realtime-spec.md` §43).
- `request.failed` is the name of the unexpected-error line today (§1); under the B3 logger it is `http.request.failed` (ADR-009 point 6, §8), as the example above shows. `realtime.disconnected` and `realtime.reconnected` are not decided (§58, `08-realtime-spec.md` §58).
- A real API failure is reproducible today only by stopping PostgreSQL, which makes `GET /health/ready` return 503 and normal requests return 500 (§57).

---

# 65. Interview Demonstration

**Status:** per step (table below)

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

What each step is in version 1:

| Step | Version 1 counterpart | Status |
| --- | --- | --- |
| 1. Show the product | The web app | `Planned (FE)` |
| 2. Open developer diagnostics | A diagnostic mode is deferred to the frontend-stage ADR (ADR-009 point 12, §39). Until then the request lifecycle is read in the API's stdout | Mode `Deferred`; stdout `Planned (B3)` |
| 3. Perform an operation | `requestId` on every response and error body is `Implemented`. `durationMs` and `result` come from `http.request.completed`, `Planned (B3)`. A generic `operation` field is not an ADR-009 field (§7, §10) | Mixed: `requestId` `Implemented`; the rest `Planned (B3)` |
| 4. Inject a failure | A controlled demo failure is a demo specific | `Deferred` (ADR-010 point 6) |
| 5. Inspect recovery | The demo failure is `Deferred`. A real retry-and-recovery chain exists for a CSV import job: `FAILED`, retry, `COMPLETED` (§58) | Demo `Deferred`; job chain `Planned (B4)` |
| 6. Demonstrate realtime | Server events `Planned (B5)`; client states and reconnect `Planned (FE)` (§28) | `Planned (B5)` / `Planned (FE)` |
| 7. Show health | `GET /health` and `GET /health/ready` (§22-23) answer in the real API (`Implemented`). The public demo is a static build with no backend (ADR-006 points 1 and 7), so it has no health endpoint | API `Implemented`; demo build has none |

Code vs ADR: `12-demo-mode-spec.md` §89 and `10-testing-strategy.md` §64 cover the same demonstration from the demo and testing sides; the order here is a suggestion, not a requirement.

---

# 66. Local Developer Experience

**Status:** per item (table below)

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

| Item | Version 1 | Status |
| --- | --- | --- |
| How to start the application | `pnpm --filter @trading/api dev` runs `tsx watch` (`apps/api/package.json`). `README.md` documents setup and the local database, not the API start | Command `Implemented`; not documented |
| Where logs appear | The stdout of the API process (ADR-009 point 3); container output under the Compose `full` profile (ADR-006 point 4, B7) | `Planned (B3)` |
| How to change the log level | `LOG_LEVEL` (ADR-009 point 7, §38) | `Planned (B3)` |
| How to enable debug mode | `LOG_LEVEL=debug`, already the development default; `ENABLE_DEBUG_LOGGING` is not adopted (ADR-009 point 2). A development realtime debug mode is deferred to the frontend-stage ADR (ADR-009 point 12, §28) | `Planned (B3)`; realtime debug mode `Deferred` |
| How to inspect health | `GET /health` and `GET /health/ready`, specified in `07-api-spec.md` §30 | `Implemented`; not in `README.md` |
| How to inspect metrics | There are none in version 1 | `Deferred` (ADR-009 point 10) |
| How to simulate failures | Demo failures are `Deferred` (ADR-010 point 6); client test faults are `Planned (FE)` (`08-realtime-spec.md` §43). On the API, stopping PostgreSQL makes readiness return 503 (§57) | Mixed, as listed |
| How to inspect realtime events | Server connection entries `Planned (B5)`; client diagnostics `Planned (FE)` (§28) | `Planned (B5)` / `Planned (FE)` |
| How to reproduce common failures | No catalog exists. The debugging workflow of §36 is `Reference` | Not decided |

Code vs ADR:

- Today a developer finds three kinds of `console` lines (§1), the `X-Request-ID` header, the `requestId` in error bodies and the two health routes. `README.md` and `CONTRIBUTING.md` mention none of them.
- Which document carries the written workflow (`README.md` or a page under `docs/`) is an open detail (B3).

---

# 67. Documentation Requirements

**Status:** `Planned (B3)` for the backend sections; the frontend and demo sections `Planned (FE)` or `Deferred`; the location is an open detail (B3)

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

Code vs ADR:

- No observability section exists in `README.md` or `CONTRIBUTING.md`; this specification is the only reference today.
- In version 1 the "Metrics" entry has nothing to document (`Deferred`, ADR-009 point 10), "Realtime diagnostics" follows B5 and the frontend stage, and "Demo diagnostics" waits for the demo ADR (ADR-010 point 6).
- ADR-009 does not list the documentation among its decisions; its "Documents to align" names `13`, `04` and `09` only. The assignment to B3 comes from §74.

---

# 68. Environment Variables

**Status:** per variable (table below)

Observability configuration may use environment variables.

Conceptual examples:

```text
LOG_LEVEL
LOG_FORMAT
ENABLE_DEBUG_LOGGING
ENABLE_METRICS
ENABLE_DEV_DIAGNOSTICS
SLOW_REQUEST_THRESHOLD_MS
```

The version 1 set is decided in the table below (ADR-009 points 2, 7 and 8); the variables not adopted stay in the list only as conceptual examples.

Secrets must never be stored in source control.

What each variable is in version 1:

| Variable | Version 1 | Status |
| --- | --- | --- |
| `LOG_LEVEL` | The only logging-format or verbosity variable (ADR-009 point 7, amended 2026-10-07): `debug` in development, `info` in production, `silent` in tests (§38). Not in `apps/api/src/config/env.ts`; whether it is validated there and whether its default follows `NODE_ENV` are open (§38). `04-tech-stack.md` and `14-deployment-spec.md` already list it | `Planned (B3)` |
| `LOG_FORMAT` | Not adopted (ADR-009 point 2). The format follows the environment: JSON lines on stdout, `pino-pretty` in development only (ADR-009 points 2-3). How the pretty output is selected is an implementation detail (B3) | Not adopted |
| `ENABLE_DEBUG_LOGGING` | Not adopted (ADR-009 point 2). Debug output is `LOG_LEVEL=debug` (ADR-009 point 7, §38) | Not adopted |
| `ENABLE_METRICS` | There are no metrics in version 1 | `Deferred` (ADR-009 point 10) |
| `ENABLE_DEV_DIAGNOSTICS` | Not adopted (ADR-009 point 2). A development diagnostic mode is deferred to the frontend-stage ADR (ADR-009 point 12, §39) | Not adopted |
| `SLOW_REQUEST_THRESHOLD_MS` | The slow-request threshold for HTTP requests only, default 500 ms, configurable (ADR-009 point 8, amended 2026-10-07, §52). It replaces the earlier working name `SLOW_OPERATION_THRESHOLD_MS`. The analytics series reconstruction is timed separately, and whether it has its own threshold is open (§52) | `Planned (B3)` |

Code vs ADR:

- `apps/api/src/config/env.ts` validates `NODE_ENV` (`development`, `test`, `production`), `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS` and `CORS_ORIGIN` with zod, and the process exits on invalid values without printing them (`Implemented`). None of the six variables above exists in code.
- `NODE_ENV` is the environment that ADR-009 point 7 keys its levels to. The web build variable is `VITE_APP_MODE`, set from `APP_MODE` (ADR-006 point 8, `Planned (FE)`); no ADR adds an observability variable to the web build.
- `14-deployment-spec.md` §10 lists `LOG_LEVEL` but also `DEMO_MODE` and `JWT_EXPIRES_IN`, which differ from ADR-006 point 8 (`APP_MODE`) and `env.ts` (`JWT_EXPIRES_IN_SECONDS`). That belongs to the `14` reconciliation.
- Secrets never reach the logs: the environment validator prints key names only, and the redaction list of ADR-009 point 4 covers tokens, cookies and passwords (`Planned (B3)`).

---

# 69. Production Considerations

**Status:** per item (table below)

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

| Item | Version 1 | Status |
| --- | --- | --- |
| Structured stdout logs | One JSON line per event (ADR-009 point 3) | `Planned (B3)` |
| Request correlation | `requestId` on responses and error bodies is `Implemented`; on log lines (ADR-009 point 5) | `Planned (B3)` |
| Safe error handling | Generic 500 body, detail in the server log only (`apps/api/src/middleware/error-handler.ts`) | `Implemented` |
| Health checks | `GET /health`, `GET /health/ready` | `Implemented` |
| Bounded metrics | No metrics | `Deferred` (ADR-009 point 10) |
| Realtime diagnostics | Server connection entries; client diagnostics | `Planned (B5)` / `Planned (FE)` |
| Configurable verbosity | `LOG_LEVEL` (ADR-009 point 7) | `Planned (B3)` |

Code vs ADR:

- "Production" in version 1 is the local `production` environment (ADR-006 point 8). No hosted backend exists, and hosting one later reopens the metrics decision (ADR-006 point 2, ADR-009 point 10).
- The provider independence of the last paragraph is the `Logger` port (ADR-009 point 1), `Planned (B3)`; nothing in the code references a provider today (§32).

---

# 70. Future Evolution

**Status:** `Deferred` (no ADR adopts any item; ADR-009 point 10 defers metrics)

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

Code vs ADR: the version 1 choices that keep these options open are the `Logger` port and JSON lines on stdout (ADR-009 points 1 and 3). OpenTelemetry is §34 and tracing is §35, both `Deferred`. SLO and SLI definitions have no basis in version 1, which is local only and carries no SLA (§52). Hosting the backend reopens the decision (ADR-009 point 10).

---

# 71. Anti-Patterns to Avoid

**Status:** `Reference`

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

How version 1 meets the list:

- Logging everything and raw objects: `LOG_LEVEL` keeps `debug` out of production (ADR-009 point 7), and payloads with user data are never logged (§54). The sampling of high-frequency events is open (§55).
- Secrets: the redaction list of ADR-009 point 4 is enforced by tests, `Planned (B3)`. The `message` of the `request.failed` line is not filtered today, and the `message` of an unexpected error stays unfiltered in v1 (ADR-009 point 4, §11).
- User IDs and request IDs as metric labels: there are no metrics (ADR-009 point 10). `userId` and `requestId` are log fields.
- Console logging everywhere: the API writes `console` lines today (§1). The `Logger` port replaces them in B3 (ADR-009 point 1). No lint rule restricts `console` in `eslint.config.js`, and none is decided.
- Provider lock-in: the `Logger` port (ADR-009 point 1) and stdout logs (§33).
- Fake metrics and fake health: there are no metrics to fake (§18), and readiness runs a real `SELECT 1` (§23).
- Production-only diagnostics: version 1 is local only (ADR-006), so every diagnostic is reproducible locally.

---

# 72. Responsibility by Layer

**Status:** `Reference`; what each layer has today is in the table below

| Layer | Observability responsibility | Version 1 counterpart | Status |
|---|---|---|---|
| UI | User-visible errors, runtime boundaries, diagnostics | Error boundaries and browser diagnostics (§15, §40) | `Planned (FE)` |
| Features | Meaningful user-flow events | Frontend events are not defined | `Planned (FE)`; events not decided |
| Application | Operation lifecycle and business-context diagnostics | Logs through the `Logger` port in `@trading/application` (ADR-009 point 1). The package does not exist yet (ADR-001, B0) | `Planned (B3)`, after the B0 layer |
| Domain | Domain events where useful | No ADR defines domain events, and the `Logger` port sits in the application layer, so the domain package logs nothing | Not decided |
| Infrastructure | Dependency errors and performance | Dependency errors reach the error handler; no query timing (§21) | Dependency error logging `Planned (B3)`; query timing `Deferred` (ADR-009 point 8) |
| API | Request correlation, status, duration | `requestId` middleware (`Implemented`); `http.request.completed` with `durationMs` (ADR-009 points 2-3) | Correlation `Implemented`; request logs `Planned (B3)` |
| Realtime | Connection/event lifecycle | Connection entries with `connectionId` (ADR-009 points 5 and 11) | `Planned (B5)` |
| Database | Connectivity and operation diagnostics | Readiness `SELECT 1` (`Implemented`); no operation diagnostics (§21) | Connectivity `Implemented`; operation timing and query logging `Deferred` (ADR-009 point 8) |
| Demo infrastructure | Simulation lifecycle and failures | Browser-console adapter; lifecycle and failure names wait for the demo ADR (§29, §56) | `Planned (FE)`; names `Deferred` |
| Observability layer | Logging, metrics, sanitization, correlation | `Logger` port, pino adapter and redaction; metrics are `Deferred` | `Planned (B3)`; metrics `Deferred` |

---

# 73. Relationship With Demo Architecture

**Status:** `Planned (FE)` (ADR-001, ADR-006 point 7, ADR-009 point 1); the way to tell a real failure from a simulated one is `Deferred` (ADR-010 point 6)

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

Code vs ADR:

- The shared boundary is the set of ports of ADR-001, of which the `Logger` port of ADR-009 point 1 is the observability one. The real adapter is pino in the API; the demo adapter writes to the browser console (`Planned (FE)`).
- Of the three outputs in the diagram, only logs apply to the demo in version 1. Metrics are `Deferred` (ADR-009 point 10), and the public demo is a static build with no backend, so it has no health endpoint (ADR-006 point 7).
- The demo has no database; its data layers are browser storage (ADR-006 point 7). What a "simulated database failure" is, and how it is marked as simulated, belongs to the demo specifics (ADR-010 point 6).

---

# 74. Definition of Done

**Status:** per item (tags below); split by scope as ADR-009 point 12 requires

The observability implementation is considered complete when:

ADR-009 point 12 splits this checklist because the backend block cannot close against frontend and demo items. Each item below ends with a tag naming the block or stage that owns it, taken from the section it depends on. The B3 checklist is closed by the items tagged B3. Items tagged B0, B4 or B5 are closed by those blocks, items tagged FE by the frontend stage, and items tagged `Deferred` are not built until a new decision.

| Scope | Items | Closed by |
| --- | --- | --- |
| Backend logging and errors | Logging, Errors (backend), Performance, Testing (utilities, correlation, error handling), Documentation | B3 |
| Backend health | Health, and the health route tests | `Implemented`; tests B0 |
| Backend jobs and realtime | Job entries; server connection entries | B4; B5 |
| Frontend | Frontend runtime errors, realtime client diagnostics | Frontend stage |
| Demo | Demo group, demo failure tests | Frontend stage; failures and reset `Deferred` (ADR-010 point 6) |
| Metrics | Metrics group | `Deferred` (ADR-009 point 10) |

### Logging

- [ ] Backend logs are structured. (B3)
- [ ] Log levels are supported. (B3)
- [ ] Stable event names are used. (B3; job names B4, realtime names B5)
- [ ] Sensitive data is sanitized. (B3)
- [ ] Request IDs are propagated. (B3; on responses and error bodies already `Implemented`)

### Errors

- [x] Backend errors are centrally handled. (`Implemented`, `apps/api/src/middleware/error-handler.ts`)
- [ ] Error categories are standardized. (B3 for log categories; B0 for the response mapping of application errors)
- [ ] Frontend runtime errors have boundaries. (FE)
- [ ] Unexpected errors are observable. (B3 as `http.request.failed`; the `request.failed` line exists today)
- [ ] User-facing errors remain safe. (B0 and B3; the generic 500 body is `Implemented`)

### Metrics

- [ ] Core HTTP metrics exist. (`Deferred`)
- [ ] Relevant application metrics exist. (`Deferred`)
- [ ] Realtime metrics exist. (`Deferred`)
- [ ] Background job metrics exist. (`Deferred`)
- [ ] Metrics remain bounded. (`Deferred`)

### Health

- [x] Liveness is available. (`Implemented`, `GET /health`)
- [x] Readiness is available where appropriate. (`Implemented`, `GET /health/ready`)
- [x] Database health is detectable. (`Implemented`)
- [x] Health output contains no secrets. (`Implemented`, §24)

### Performance

- [ ] Important operations can be timed. (B3: request duration and the analytics series reconstruction)
- [ ] Slow operations can be diagnosed. (B3: the slow-request `warn`)
- [ ] No performance claim is made without measurement. (`Reference`, §51)

### Realtime

- [ ] Connections are observable. (B5 on the server, FE on the client)
- [ ] Reconnects are observable. (B5 connection entry, FE client diagnostics; the name is not decided, §58)
- [ ] Realtime errors are observable. (B5, FE)
- [ ] Debug logging can be controlled. (B5 through `LOG_LEVEL`; a development realtime debug mode is `Deferred` to the frontend-stage ADR, ADR-009 point 12, §28)

### Demo

- [ ] Demo lifecycle is observable. (FE; names `Deferred`)
- [ ] Simulated failures are observable. (`Deferred`, ADR-010 point 6)
- [ ] Realtime simulation is observable. (FE)
- [ ] Background simulations are observable. (FE)
- [ ] Reset clears appropriate diagnostic state. (`Deferred`, ADR-010 point 6)

### Testing

- [ ] Observability utilities have unit tests. (B3)
- [ ] Request correlation has integration coverage. (B3)
- [ ] Error handling has integration coverage. (B3; assignment is an open detail, §59)
- [ ] Health checks are tested. (B0, ADR-001 point 8, §59)
- [ ] Critical demo failure scenarios are tested. (`Deferred`)

### Documentation

- [ ] Local observability workflow is documented. (B3)
- [ ] Log levels are documented. (B3)
- [ ] Health endpoints are documented. (`07-api-spec.md` §30 documents them; the developer workflow does not, B3)
- [ ] Demo diagnostics are documented. (FE; `Deferred` with the diagnostics interface, §30)
- [ ] Troubleshooting workflow is documented. (B3, §36)

Code vs ADR:

- The checked items are the ones whose behavior exists in `apps/api` today. They are checked because the code does what the item says, not because a test covers them: no test covers the health routes or the error handler (§59). The health route test is part of the B0 set (ADR-001 point 8).
- ADR-009 point 12 fixes the split but not the assignment of each item; the tags are derived from the sections above and follow their statuses.

---

# 75. Acceptance Criteria

**Status:** per question (table below); the criteria are met only once B3 lands

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

How each question is answered in version 1:

| # | Mechanism | Status |
| --- | --- | --- |
| 1. What operation failed? | The `event` name and the request entry of the failing request (ADR-009 point 3). Route fields beyond ADR-009 point 3 are open (§7) | `Planned (B3)` |
| 2. Which request initiated it? | `requestId` in the response and error body; on every log line | Response `Implemented`; logs `Planned (B3)` (ADR-009 point 5) |
| 3. Which application layer failed? | The stack trace of internal errors (ADR-009 point 6). A layer or module field (`source`, `module`) is not adopted in v1 (ADR-009 point 3, §7) | `Planned (B3)`; layer field not adopted |
| 4. What type of error occurred? | The `code` of the error body, and `errorCategory` on the log entry, which carries the same `AppErrorCode` value; `errorName` appears only on the unexpected-error line (ADR-009 point 3, §7) | Body `Implemented`; log `Planned (B3)` |
| 5. Was the failure expected or unexpected? | The level by category: `warn` for validation, authentication, `FORBIDDEN` and `RATE_LIMITED`, `info` for not-found and conflict, `error` with a stack for internal errors and `DEPENDENCY_ERROR` (ADR-009 point 6). Only unexpected errors are logged today | `Planned (B3)` |
| 6. Was a retry attempted? | Job retry and its `attempt` (ADR-008 point 6); client reconnect attempts (`08-realtime-spec.md` §58); the HTTP client retry policy waits for the frontend-stage ADR (ADR-006 point 11) | `Planned (B4)` / `Planned (FE)` |
| 7. Did the system recover? | Job entries sharing a `jobId` (§58). There is no database recovery entry in v1 (ADR-009 point 11); the name of the realtime reconnect entry is not decided (§58) | Jobs `Planned (B4)`; database recovery entry `Deferred` (B7); reconnect name not decided |
| 8. What was the approximate operation duration? | `durationMs` on `http.request.completed`; the series reconstruction is timed separately (ADR-009 point 8) | `Planned (B3)` |
| 9. Was a dependency involved? | PostgreSQL is the only dependency. Readiness reports it; a request that fails because of it returns 503 `DEPENDENCY_ERROR` (ADR-002 point 10) | Readiness `Implemented`; 503 `Planned (B0)`; log classification `Planned (B3)` |
| 10. Can the same failure be reproduced locally? | The project is local only (ADR-006), the database can be reseeded (`README.md`), the simulator is seeded (ADR-007 point 7, `Planned (B5)`), and PostgreSQL can be stopped. Scripted demo failures are `Deferred` (ADR-010 point 6) | Local reproduction `Implemented`; scripted failures `Deferred` |

Code vs ADR:

- Today a developer can answer questions 2 (from the response only), 4 (from the response code) and 9 (from readiness); the other seven wait for the B3 logger.
- Question 5: ADR-009 point 6 (amended 2026-10-07) assigns `FORBIDDEN` and `RATE_LIMITED` to `warn` and `DEPENDENCY_ERROR` to `error` with the stack (§6.2).
- Question 7: for the database the chain stays incomplete in v1 by decision (§58).

---

# 76. Final Architecture Principle

**Status:** `Reference`

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

Code vs ADR: the chain in the diagram is covered unevenly today. `Request` has its `requestId`; `Operation`, `Dependency` and `Result` need the B3 logger; `Recovery` is incomplete for the database in v1 by decision (ADR-009 point 11, §58), and for a realtime connection until the name of the reconnect entry is decided.

---

## 77. Relationship to Other SDDs

**Status:** `Reference`

This document depends on and complements:

- `00-overview.md` — project scope and principles
- `01-product-spec.md` — product behavior
- `02-functional-requirements.md` — functional requirements
- `03-non-functional-requirements.md` — quality attributes (NFR-049 to NFR-051 and NFR-070)
- `04-tech-stack.md` — technical stack (logging library)
- `05-data-model.md` — the `Job` entity behind the job lifecycle entries (§43)
- `06-architecture.md` — system architecture
- `07-api-spec.md` — API contracts (health routes, error bodies)
- `08-realtime-spec.md` — realtime architecture
- `09-security-spec.md` — security specification (§50, security events)
- `10-testing-strategy.md` — testing approach (CI, §53)
- `11-ui-ux-spec.md` — interface and UX behavior
- `12-demo-mode-spec.md` — demo infrastructure and simulation
- `14-deployment-spec.md` — packaging, configuration and environments
- `15-implementation-plan.md` — the implementation phases that cite this document
- `adr/0009-observability-scope.md` — the decision that sets the scope of this document; `adr/0001-application-layer.md`, `adr/0006-deployment-model-and-ci.md`, `adr/0007-realtime-and-market-simulation.md`, `adr/0008-background-jobs-csv-import.md` and `adr/0010-v1-product-scope-clarifications.md` supply the other decisions cited here

Where this document and an ADR differ, the ADR wins (`README.md`, precedence).

The next document, `14-deployment-spec.md`, defines how the application is packaged, configured, deployed and run across local and production-like environments.

---

# Document Status

**Status:** All sections reconciled with the code and ADRs on 2026-10-07

This document defines the observability architecture for version 1 as decided in ADR-009: structured, correlated and safe backend logging in B3, metrics `Deferred`, and the frontend and demo parts in the frontend stage. Where it differs from ADR-009, the ADR wins. The decisions approved on 2026-10-07 (ADR-009 points 2-13, ADR-006 point 12, ADR-001 point 8) are applied throughout. Event names marked as working names, the levels of lifecycle, simulator and shutdown entries, thresholds other than the slow-request default, and the other open details listed per section are specified in the block that implements them (B0, B3, B4, B5, B7) or in the frontend-stage and demo ADRs. Metric names and exporters apply only if the metrics decision is reopened (ADR-009 point 10).
