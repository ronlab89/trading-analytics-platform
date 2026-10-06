# SDD 03 — Non-Functional Requirements

**Project:** Trading Analytics Platform  
**Status:** §1-§9 reconciled with the ADRs and the code on 2026-10-05 (task T3.2); later sections Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`

Status values follow the legend in `docs/README.md`. Targets that had no
number before the 2026-10-05 reconciliation were set then and approved by the
project owner; they are revised only through a documented change.

---

# 1. Purpose

**Status:** `Reference`

This document defines **how well** the system must do what
`02-functional-requirements.md` defines. It covers performance, scalability,
reliability, resilience, security, accessibility, maintainability,
developer experience, observability, testability, deployment and cost.

Each requirement applies to the local full stack and, where applicable, to
the static public demo (ADR-006). Every requirement states a target and how
it is checked; where an ADR knowingly limits a requirement, the exception is
written next to it.

---

# 2. Engineering Philosophy

**Status:** `Reference`

Prefer simple, well-defined, composable and testable designs over
distributed or expensive ones. A technology or architectural pattern needs a
clear engineering justification (see NFR-070).

---

# 3. Requirement Priorities

**Status:** `Reference`

| Priority | Meaning |
| --- | --- |
| P0 — Critical | Failure directly compromises the product. |
| P1 — Required | Important for a production-quality implementation. |
| P2 — Valuable | Improves quality but does not block the initial release. |
| P3 — Future | Possible evolution beyond the initial implementation. |

---

# 4. Performance

## NFR-001 — Initial Application Load

**Priority:** P0  
**Status:** `Planned (FE)`

### Target

- LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms.

### Measurement

Lighthouse (mobile preset, simulated throttling) on the production build of
the static demo (ADR-006). The requirement passes when every listed metric
meets its threshold. Non-critical resources are lazy-loaded so the first
view needs no blocking request beyond the application bundle.

---

## NFR-002 — Route Navigation

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

- Visible UI response to a client-side navigation within 100 ms.
- A loading indicator whenever the target view is not ready within
  300 ms.

### Measurement

Browser performance trace on the production build: time from the click to
the first frame of the new route or of its loading state.

---

## NFR-003 — Interaction Responsiveness

**Priority:** P0  
**Status:** `Planned (FE)`

### Target

- INP ≤ 200 ms (as NFR-001) for filtering, sorting, dialogs, portfolio
  switching, chart interaction, Decision Replay and Scenario Lab.
- No main-thread task longer than 200 ms during these
  interactions; heavier calculations move off the main thread or are split.

### Measurement

Browser performance trace (Long Tasks) while running each listed
interaction on the seeded dataset.

---

# 5. Real-Time Performance

## NFR-004 — Market Update Propagation

**Priority:** P1  
**Status:** `Planned (B5)` (server); `Planned (FE)` (client)

### Target

UI-visible price updates within 100 ms of the client receiving the
simulated event. The target covers application propagation only, not
market-data latency (all prices are simulated, ADR-007).

### Measurement

Client instrumentation comparing the event receipt time with the next
frame that shows the new price, in both real and demo mode.

---

## NFR-005 — Update Stability

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

A `MARKET_PRICE_UPDATED` event re-renders only components that display the
affected asset or a value derived from it; no full-page re-render and no
redraw of charts that do not plot that asset.

### Measurement

Component tests with render counting (one event → only subscribed
components render), plus a profiler check during continuous ticking.

---

## NFR-006 — Burst Handling

**Priority:** P2  
**Status:** `Planned (B5)` (server limits); `Planned (FE)` (client batching)

### Target

- Server: per-connection subscription limit, inbound message rate limit
  and bounded memory per connection (ADR-007 point 11).
- Client: a burst of 100 events within 1 s keeps INP
  ≤ 200 ms and is applied in at most one render per animation frame.

### Measurement

Simulator scenario that emits the burst; browser trace on the client and
realtime tests for the server limits (`08-realtime-spec.md`).

---

# 6. Data and Calculation Performance

## NFR-007 — Derived Analytics

**Priority:** P1  
**Status:** `Planned (B1)` (server); `Planned (FE)` (client)

### Target

- Client: derived values recompute only when their source data changes
  (transaction → position → portfolio metrics → analytics); unrelated views
  do not recompute.
- Server: an analytics request over the seeded 90-day history completes
  within 500 ms, the ADR-009 slow-operation threshold.

### Accepted exception

ADR-004 rebuilds the value series on every request and adds caching only
when measured to be needed. The server therefore does not avoid
recomputation in version 1; it is bounded by the time target instead.

### Measurement

Server: the separate timing of series reconstruction (ADR-009 point 8)
stays under the slow-operation threshold. Client: selector or memo tests
showing no recomputation on unrelated state changes.

---

## NFR-008 — Large Historical Datasets

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Charts with 5 years of daily points per asset keep INP
≤ 200 ms and initial chart render ≤ 500 ms. Techniques
(windowing, aggregation, memoization, progressive loading, canvas) are
chosen per chart in the frontend stage.

### Measurement

Browser trace with a generated 5-year dataset in demo mode.

---

# 7. Scalability

## NFR-009 — Horizontal Growth

**Priority:** P1  
**Status:** `Deferred` (ADR-006)

### Accepted exception

ADR-006 limits version 1 to a single local backend instance and a static
demo; there is no hosted backend. Realtime connections and subscriptions
(ADR-007) and the job runner (ADR-008) are deliberately in-process. No
multi-instance target applies in version 1. Hosting the backend requires a
new ADR, which reopens this requirement.

### What still holds

Persistent state lives in PostgreSQL, not in process memory (see NFR-010).

---

## NFR-010 — Stateless Application Layer

**Priority:** P1  
**Status:** persistent state in PostgreSQL `Implemented`; refresh sessions
`Planned (B2)`; in-process realtime and job runner accepted (ADR-007,
ADR-008)

### Target

All business data, jobs (`jobs` table, ADR-008) and idempotency records
(ADR-008) are stored in PostgreSQL. An API restart loses no persisted
state: jobs left `PROCESSING` become `FAILED` with reason `INTERRUPTED` and
`QUEUED` jobs resume (ADR-008 point 5).

### Accepted exception

Realtime sockets and subscriptions live in process memory (ADR-007); a
restart drops them and clients reconnect and resynchronize (NFR-018).

### Measurement

Restart test for the job runner (B4) and the existing API integration
tests against PostgreSQL.

---

## NFR-011 — Domain Isolation

**Priority:** P1  
**Status:** entities reference other aggregates by ID `Implemented`
(`packages/domain/src/entities`); lint import-boundary rules
`Planned (B0)` (ADR-001 point 1; today only a placeholder in
`eslint.config.js`, see `06-architecture.md` §43)

### Target

Domains (portfolios, positions, transactions, assets, analytics, decisions,
scenarios, notifications) reference each other only by identifier, and
`@trading/domain` depends on no application or infrastructure package
(ADR-001).

### Measurement

Code review today; a lint rule (`no-restricted-imports` or equivalent)
failing the build on a cross-layer import once the deferred check is built.

---

## NFR-012 — Data Growth

**Priority:** P1  
**Status:** paginated lists `Implemented` (transactions, assets); remaining
collections follow the same rule when built

### Target

Every collection endpoint is paginated with a bounded page size (default
20, maximum 100, `apps/api/src/schemas/pagination.schema.ts`). No endpoint
returns an unbounded list.

### Measurement

Request validation rejects `pageSize` above 100; API tests per collection
endpoint.

---

# 8. Reliability

## NFR-013 — Graceful Failure

**Priority:** P0  
**Status:** API error envelope with `requestId` `Implemented`; UI error
states `Planned (FE)`

### Target

- Every API failure returns the standard error envelope with a `requestId`
  (`07-api-spec.md`); no unhandled error terminates the process.
- Every failed UI request shows an error state with a user-readable message
  and, for retryable failures, a retry action; already-loaded valid data
  stays visible.

### Measurement

API tests for each error category (`apps/api/src/middleware/error-handler.ts`);
component tests for error and retry states.

---

## NFR-014 — Partial Failure Isolation

**Priority:** P1  
**Status:** `Planned (B5)` (server); `Planned (FE)` (client)

### Target

With the realtime socket down, portfolios, transactions and historical
analytics remain usable through HTTP; the UI shows a stale-data indicator
and refetches periodically until reconnection (ADR-007 point 12). Analytics
with missing prices return partial results (`16-analytics-spec.md` §16).

### Measurement

Realtime failure test in B5 ("realtime failure degrades to HTTP",
`BACKEND-ROADMAP.md`) and a UI test with the realtime adapter disconnected.

---

## NFR-015 — Operation Consistency

**Priority:** P0  
**Status:** transaction creation `Implemented`; CSV import `Planned (B4)`

### Target

A mutation that changes several entities either commits all of them or
none. Transaction creation writes the transaction, recalculates the
position and marks it `COMPLETED` in one `UnitOfWork`
(`apps/api/src/services/transaction.service.ts`). CSV import applies all
rows in one `UnitOfWork` (ADR-008 point 2).

### Measurement

Integration tests forcing a failure mid-operation and asserting no partial
state (`apps/api/src/routes/transactions.routes.test.ts`; B4 import tests).

---

# 9. Resilience

## NFR-016 — Retry Safety

**Priority:** P1  
**Status:** `Planned (B4)` (ADR-008)

### Target

- Repeating a state-changing request with the same `Idempotency-Key`
  returns the stored response and applies the change once
  (`07-api-spec.md` §39). The key and response are written in the same
  `UnitOfWork` as the mutation; 5xx outcomes are not stored (ADR-008).
- A job retry never imports the same rows twice (ADR-008 point 7).

### Measurement

B4 idempotency tests with duplicate and concurrent submissions.

---

## NFR-017 — Timeout Handling

**Priority:** P1  
**Status:** job timeouts `Planned (B4)`; client request timeouts
`Planned (FE)`

### Target

- Each job type has a timeout per attempt while `QUEUED` or validating;
  exceeding it ends in `TIMED_OUT`, which is retryable (ADR-008 points 6-7).
  The apply stage is exempt.
- Client HTTP requests time out after 15 s and show a timeout
  state with a retry action.
- Requests slower than 500 ms are logged at `warn` (ADR-009 point 8).

### Measurement

B4 state-transition tests for timeout; client tests with a delayed mock.

---

## NFR-018 — Real-Time Reconnection

**Priority:** P1  
**Status:** `Planned (B5)` (server); `Planned (FE)` (client)

### Target

- Heartbeat: ping/pong every 30 s (ADR-007 point 11); unauthenticated
  sockets close after 5 s (ADR-007 point 2).
- Reconnection uses exponential backoff from 1 s, doubling, capped at
  30 s, with jitter.
- After reconnecting, the client restores each subscription exactly once.
- A `sequence` gap or a reconnect triggers an HTTP resynchronization;
  events with an already-seen `sequence` are discarded (ADR-007 point 5).

### Accepted exception

No server-side replay buffer in version 1 (ADR-007): missed events are
recovered by HTTP resynchronization, not replayed.

### Measurement

B5 reconnect, duplicate and stale-event tests (`08-realtime-spec.md` §59)
and client tests with a simulated disconnect.

---

# 10. Security

## NFR-019 — Authentication Security

**Priority:** P0  
**Status:** password hashing, login rate limit and access-token expiry
`Implemented`; refresh sessions `Planned (B2)` (ADR-005); log redaction
`Planned (B3)` (ADR-009)

### Target

- Passwords are hashed with `bcryptjs` at cost 10 or higher;
  login returns a generic "Invalid credentials." error.
- Login is limited to 5 attempts per 15 minutes per IP (ADR-005 point 12).
- Access tokens expire after 900 s (`JWT_EXPIRES_IN_SECONDS`); `JWT_SECRET`
  has at least 32 characters, or the API refuses to start.
- Refresh tokens are opaque, stored hashed, rotate on every use, and reuse
  of a rotated token revokes the family (ADR-005 point 5).
- Credentials and tokens never appear in URLs, logs, analytics events or
  error messages (ADR-009 point 4).

### Accepted exception

No self-registration; users come from the seed (ADR-005 point 10). An
issued access token stays valid until expiry, at most 15 minutes, after
logout (ADR-005 point 6).

### Measurement

`apps/api/src/middleware/rate-limit.test.ts`; startup fails with a short
`JWT_SECRET` (`apps/api/src/config/env.ts`); B2 refresh rotation and reuse
tests; B3 redaction unit tests.

---

## NFR-020 — Authorization

**Priority:** P0  
**Status:** ownership checks `Implemented`; permission matrix `Planned (B2)`
(ADR-005)

### Target

- Every protected route checks ownership server-side; another user's
  resource returns 404, never 403 (ADR-005 point 12).
- Every use case receives an `Actor` and checks permission and ownership in
  the application layer; code checks permissions, never role names
  (ADR-005 points 2-3).
- The frontend is not a security boundary.

### Measurement

Cross-user 404 route tests (for example
`apps/api/src/routes/portfolios.routes.test.ts`); B2 tests for allowed
role, denied role, cross-user access and escalation attempts
(`09-security-spec.md` §55).

---

## NFR-021 — Input Validation

**Priority:** P0  
**Status:** body and query validation `Implemented`; route (path)
parameter validation `Planned (B0)` (ADR-002 point 10); shared schemas in
`@trading/contracts` `Planned (B0)` (ADR-002); client validation
`Planned (FE)`

### Target

```text
Client      UX only, same schemas
Server      Zod at the HTTP boundary (required)
Domain      invariants in domain validators
```

- Every request body, query and path parameter is parsed before reaching a
  service; invalid input returns 400 with the standard error envelope.
  Today only body and query are parsed; path parameters are `Planned (B0)`.
  A malformed path parameter returns 400 `VALIDATION_ERROR`; a well-formed
  but unknown or not-owned resource returns 404 `NOT_FOUND` (ADR-002
  point 10).
- JSON bodies are limited to 100 kb (`apps/api/src/app.ts`).
- Client validation never replaces server validation (ADR-001 point 5).

### Measurement

`apps/api/src/middleware/validate.test.ts` and route tests asserting 400
for invalid input; B0 contract tests.

---

## NFR-022 — Sensitive Data Handling

**Priority:** P0  
**Status:** `Implemented` for errors and health output; token storage
`Planned (B2)`; log redaction `Planned (B3)`

### Target

- Unclassified errors return a generic message; details go to server logs
  only (`apps/api/src/middleware/error-handler.ts`).
- Health responses expose no connection strings or driver errors.
- Passwords and refresh tokens are stored only as hashes; logs carry
  `userId` only, never other personal data (ADR-009 point 3).

### Measurement

Error-handler tests for 500 responses; readiness test with the database
down; B3 redaction tests.

---

## NFR-023 — Secret Management

**Priority:** P0  
**Status:** `Implemented` (API); demo build `Planned (FE)` (ADR-006
point 7)

### Target

- No secret file is tracked: `.env` and `.env.*.local` are ignored; only
  `*.example` files are committed.
- Required secrets are validated at startup; invalid configuration exits
  with code 1 and names the key, never the value.
- The static demo build contains no secrets.

### Measurement

`git ls-files` lists no `.env` file other than examples; startup test with
a missing `JWT_SECRET`; FE check that the demo bundle has no API secret
variable.

---

## NFR-024 — Dependency Security

**Priority:** P1  
**Status:** `Planned (B7)` (security checklist, `14-deployment-spec.md`
§78)

### Target

`pnpm audit --prod --audit-level=high` reports 0 high or critical
advisories, or each remaining one is recorded with a reason.

### Accepted exception

The minimal CI of ADR-006 point 10 does not run a dependency audit, and no
automated update bot is configured; the audit is a manual checklist step.

### Measurement

Audit output attached to the B7 checklist.

---

## NFR-025 — Secure Headers

**Priority:** P1  
**Status:** API headers `Implemented` (`helmet` defaults, `x-powered-by`
disabled, CORS allow-list from `CORS_ORIGIN`); demo hosting headers
`Deferred` (ADR-006)

### Target

Every API response carries the `helmet` default headers and no
`X-Powered-By`; cross-origin requests are allowed only from `CORS_ORIGIN`.

### Accepted exception

No hosted backend, TLS termination or reverse proxy in version 1
(ADR-006 point 2); headers of the static demo host are not controlled.

### Measurement

An API test asserting `X-Content-Type-Options: nosniff` and no
`X-Powered-By`; no such test exists yet.

---

# 11. Frontend Security

## NFR-026 — Client Trust Boundary

**Priority:** P0  
**Status:** server enforcement `Implemented` (ownership); application-layer
enforcement `Planned (B0)`/`Planned (B2)` (ADR-001, ADR-005)

### Target

Every security decision is enforced by the API; hiding a control in the UI
is never the only protection.

### Accepted exception

The demo runs without a server, so its permission checks (ADR-005
point 11) give behavior parity, not security.

### Measurement

The NFR-020 tests call the API directly, bypassing the UI.

---

## NFR-027 — XSS Prevention

**Priority:** P0  
**Status:** `Planned (FE)`

### Target

- User-provided and imported content (notes, CSV fields) renders as text.
- No `dangerouslySetInnerHTML` or `innerHTML` use without sanitization;
  0 unsanitized occurrences in `apps/web`.

### Measurement

A repository search or lint rule over `apps/web` finds 0 unsanitized
occurrences; a component test renders `<script>` in a note as text.

---

## NFR-028 — Token Handling

**Priority:** P1  
**Status:** `Planned (B2)` (server); `Planned (FE)` (client) (ADR-005)

### Target

- The access token lives in memory only, never in `localStorage` or
  `sessionStorage` (ADR-005 point 4).
- The refresh cookie is `HttpOnly`, `Secure`, `SameSite=Strict`,
  `Path=/api/v1/auth`; refresh and logout require a custom request header
  (ADR-005 points 5 and 7).

### Measurement

B2 tests asserting the cookie attributes and the custom-header check; an
FE test asserting browser storage holds no token after login.

---

# 12. Accessibility

## NFR-029 — WCAG Alignment

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Core workflows meet WCAG 2.2 AA: keyboard access, semantic structure,
visible focus, contrast of 4.5:1 for text (3:1 for large text and UI
components), labelled form fields and announced status changes. Automated
checks report 0 serious or critical violations on core routes.

### Measurement

Automated accessibility scan in end-to-end tests of core routes, plus the
manual checks of NFR-030 and NFR-031.

---

## NFR-030 — Keyboard Navigation

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Navigation, forms, dialogs, filters, tables, scenario controls and replay
controls are completable with the keyboard only; dialogs trap focus and
return it on close.

### Measurement

One keyboard-only end-to-end test per listed workflow.

---

## NFR-031 — Screen Reader Compatibility

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Loading, success, error, stale-data and connection-status changes are
announced through live regions; charts have a text alternative.

### Measurement

Component tests asserting live-region content; a manual screen-reader pass
on core workflows before the frontend stage closes.

---

## NFR-032 — Reduced Motion

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

With `prefers-reduced-motion: reduce`, non-essential animations and
transitions are disabled; no information is conveyed by motion alone.

### Measurement

End-to-end test with reduced motion emulated, asserting the affected
elements have no running animation.

---

# 13. Maintainability

## NFR-033 — Modular Architecture

**Priority:** P0  
**Status:** package structure `Implemented`; application and contracts
packages `Planned (B0)` (ADR-001, ADR-002)

### Target

- Code is grouped by domain in workspace packages; the package graph has
  no cycles.
- Business logic exists in one place (NFR-036); no shared mutable module
  state.

### Measurement

`pnpm typecheck` (`tsc --build` with project references, which rejects
reference cycles) exits 0. Cycles inside a package are not checked
automatically.

---

## NFR-034 — Separation of Concerns

**Priority:** P0  
**Status:** `Planned (B0)` (ADR-001)

### Target

```text
apps (Express, web, demo)  ->  @trading/application  ->  @trading/domain
infrastructure (@trading/database)  ->  domain contracts
```

`@trading/application` imports neither Prisma, Express, transport Zod
schemas nor browser APIs (ADR-001 point 1).

### Measurement

A `no-restricted-imports` lint rule (placeholder today in
`eslint.config.js`) makes `pnpm lint` fail on a forbidden import.

---

## NFR-035 — Reusable Components

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Each UI primitive (button, input, dialog, table) is defined once and
reused; a component is generalized only when it has at least two real
uses.

### Measurement

Code review against `11-ui-ux-spec.md`.

---

## NFR-036 — Shared Business Logic

**Priority:** P0  
**Status:** domain calculations `Implemented` (`@trading/domain`);
analytics `Planned (B1)` (ADR-004); read models `Planned (B0)` (ADR-001
point 6)

### Target

Portfolio value, P/L, allocation, attribution and scenario impact are
computed only in `@trading/domain` or `@trading/application`; the UI
displays DTOs and does not recompute them (ADR-002).

### Measurement

Each calculation has unit tests in its owning package; FE review finds no
calculation in `apps/web`.

---

## NFR-037 — Explicit Dependencies

**Priority:** P1  
**Status:** repository contracts `Implemented` (`@trading/domain`);
factory injection and composition root `Planned (B0)` (ADR-001 points 2
and 4)

### Target

Services receive their dependencies through factory parameters; only the
composition roots (`apps/api/src/composition.ts`, the demo root) choose
implementations.

### Measurement

Application tests build services with in-memory implementations only.

---

# 14. Code Quality

## NFR-038 — Type Safety

**Priority:** P0  
**Status:** `Implemented`

### Target

`strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are
on (`tsconfig.base.json`); `@typescript-eslint/no-explicit-any` is an
error; DTO types are inferred from `@trading/contracts` schemas, not
redeclared (ADR-002, `Planned (B0)`).

### Measurement

`pnpm typecheck` and `pnpm lint` exit 0.

---

## NFR-039 — Linting

**Priority:** P1  
**Status:** `Implemented` (local); CI `Planned (B0)` (ADR-006 point 10)

### Target

`pnpm lint` exits 0 with no errors on every change.

### Measurement

`pnpm lint`, run by the pre-commit hook (`lint-staged`) and by CI.

---

## NFR-040 — Formatting

**Priority:** P1  
**Status:** `Implemented`

### Target

All code and docs are formatted by Prettier; formatting never depends on
manual discipline.

### Measurement

`pnpm format:check` exits 0; the pre-commit hook formats staged files.

---

## NFR-041 — Static Analysis

**Priority:** P1  
**Status:** `Implemented` (TypeScript and ESLint)

### Target

Type errors, unsafe `any` and common bug patterns are caught by
`pnpm typecheck` and `pnpm lint`.

### Accepted exception

No dedicated analyzer for code smells, complexity or duplication;
these are covered by review (NFR-070).

### Measurement

`pnpm typecheck` and `pnpm lint` exit 0.

---

# 15. Testability

## NFR-042 — Deterministic Business Logic

**Priority:** P0  
**Status:** domain calculations `Implemented`; analytics `Planned (B1)`
(ADR-004)

### Target

P/L, allocation, attribution, portfolio value, scenario calculations and
pulse classifications are pure functions: same input, same output, no
clock, randomness or I/O inside.

### Measurement

`pnpm --filter @trading/domain test` passes; it needs no database.

---

## NFR-043 — Testable Services

**Priority:** P0  
**Status:** `Implemented` (API in-process); application factories
`Planned (B0)` (ADR-001)

### Target

The API is testable in-process through `createApp()` without binding a
port; application services are testable without HTTP or UI.

### Measurement

Supertest suites in `apps/api` (`pnpm --filter @trading/api test`); B0
application tests.

---

## NFR-044 — Mockable Infrastructure

**Priority:** P0  
**Status:** repository contracts `Implemented`; in-memory implementations
`Planned (FE)` (ADR-001 point 4)

### Target

Every infrastructure dependency sits behind a contract with an in-memory
implementation; the demo and the API pass the same contract tests
(ADR-002).

### Measurement

Shared contract tests run against both implementations.

---

## NFR-045 — Demo Determinism

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

The demo starts from a seeded dataset; the same seed produces the same
initial state and the same simulated series.

### Measurement

A test runs the demo initialization twice with one seed and compares the
resulting state.

---

# 16. Developer Experience

## NFR-046 — Local Setup

**Priority:** P0  
**Status:** `Implemented` (`README.md`, `docker-compose.yml`)

### Target

From a clean clone, the documented steps (install, environment file,
database, migrate, seed, run) start the API with no undocumented step, in
15 minutes or less.

### Measurement

Follow `README.md` on a clean clone; any missing step is a defect.

---

## NFR-047 — Environment Configuration

**Priority:** P1  
**Status:** API `Implemented` (`apps/api/src/config/env.ts`); `APP_MODE`
and `VITE_APP_MODE` `Planned (FE)` (ADR-006 point 8; read by the web build, not the API, as in `06-architecture.md` §6.2)

### Target

- Environments: `development`, `test` and local `production`
  (ADR-006 point 8). Demo is a mode (`APP_MODE=demo`), not an environment.
- Configuration is read from environment variables and validated at
  startup; canonical names: `PORT` (default `7001`),
  `JWT_EXPIRES_IN_SECONDS`, `APP_MODE`.

### Measurement

Startup test with invalid values; `.env.example` and `.env.test.example`
list every variable.

---

## NFR-048 — Development Documentation

**Priority:** P1  
**Status:** `Implemented`

### Target

The repository documents how to run, the architecture, environment
configuration, testing, the build, deployment (local and static demo) and
decisions (`docs/adr/`).

### Measurement

`pnpm docs:check` exits 0; `README.md` links each listed topic.

---

# 17. Observability

## NFR-049 — Structured Logging

**Priority:** P1  
**Status:** `Planned (B3)` (ADR-009); today only the error handler and
readiness check write ad hoc JSON lines

### Target

One JSON line per event on stdout via a `Logger` port (pino adapter), with
`timestamp`, `level`, `event`, `requestId`, `userId` and, where relevant,
`durationMs` and `errorCategory`. Passwords, `Authorization`, cookies and
tokens are never logged (ADR-009 points 1-4).

### Accepted exception

No log files or rotation (ADR-009 point 3).

### Measurement

B3 unit tests for redaction and event names; integration test asserting a
request's `requestId` appears in its log entries (ADR-009 point 13).

---

## NFR-050 — Error Tracking

**Priority:** P1  
**Status:** `Planned (B3)` (ADR-009)

### Target

Every 5xx produces one `error` log entry with `requestId` and stack trace;
validation and authentication failures log at `warn`, not-found and
conflict at `info` (ADR-009 point 6).

### Accepted exception

Logs are the only error-tracking mechanism; no paid or hosted service.
Metrics are `Deferred` (ADR-009 point 10).

### Measurement

B3 error-handler tests per category.

---

## NFR-051 — Health Checks

**Priority:** P1  
**Status:** `Implemented`

### Target

- `GET /health` (liveness) returns 200 without checking dependencies.
- `GET /health/ready` returns 200 with `checks.database: "ok"`, or 503 with
  `"unavailable"`, exposing no internal detail.
- Health routes are never rate-limited.

### Accepted exception

No separate "degraded" state in version 1: the only
dependency is the database.

### Measurement

Health route tests, including readiness with the database down.

---

# 18. Deployment and Infrastructure

## NFR-052 — Free-Tier Compatibility

**Priority:** P0  
**Status:** local stack `Implemented` (PostgreSQL via Docker Compose);
static demo `Planned (FE)` (ADR-006)

### Target

Version 1 costs nothing to run: the full stack runs locally and the public
demo is a static build servable by any free static host.

### Accepted exception

No hosted backend or managed database (ADR-006 point 2); hosting one later
requires a new ADR.

### Measurement

The deployment inventory lists no paid service.

---

## NFR-053 — No Required Paid APIs

**Priority:** P0  
**Status:** API `Implemented` (seeded market data, no external API
calls); demo `Planned (FE)`

### Target

No feature requires a paid external API; the demo makes no backend calls
(ADR-006 point 7). External market data, if ever added, is optional.

### Measurement

End-to-end test of the demo build asserting 0 requests outside its own
origin.

---

## NFR-054 — Resource Efficiency

**Priority:** P1  
**Status:** `Planned (B7)` (resource limits in the security checklist)

### Target

- The API runs within a 512 MB container memory limit in the
  `full` Compose profile.
- List endpoints are paginated; each client holds at most one realtime
  connection.

### Measurement

B7 smoke test passes under the configured container limit.

---

## NFR-055 — Deployment Reproducibility

**Priority:** P1  
**Status:** `Planned (B7)` (build and containers); minimal CI
`Planned (B0)` (ADR-006)

### Target

- A clean checkout builds every package to `dist` and runs the API with
  `node dist/index.js` in a multi-stage, non-root container; startup
  applies `prisma migrate deploy`; the seed never runs automatically
  (ADR-006 points 3-5).
- One GitHub Actions workflow on pushes and pull requests to `develop` and
  `main` installs from the lockfile, typechecks, lints and runs the
  domain, database and API suites (ADR-006 point 10).
- No environment-specific value is hard-coded.

### Accepted exception

Forward-fix only, no rollback (ADR-006 point 6); no continuous deployment
(ADR-006 point 10); backups not applicable locally (ADR-006 point 9).

### Measurement

B7: `docker compose --profile full up` from a clean checkout passes the
smoke test; CI run green on a pull request.

---

# 19. Demo Architecture Constraints

## NFR-056 — Infrastructure Substitution

**Priority:** P0  
**Status:** application layer and `TradingClient` port `Planned (B0)`
(ADR-001, ADR-002); in-process demo adapter `Planned (FE)` (ADR-002 point 5)

### Target

The demo replaces infrastructure without touching the UI: the web app
consumes data only through the `TradingClient` port, with an HTTP adapter
(real mode) and an in-process adapter that calls `@trading/application`
(demo mode). The UI cannot tell which mode it runs in (ADR-002 point 5).

```text
UI -> TradingClient port -+-> HTTP adapter -> API -> application -> Prisma
                          +-> in-process adapter -> application -> in-memory
```

### Measurement

0 UI components differ between modes: switching `VITE_APP_MODE` changes
only the composition root, and the same UI tests pass in both modes.

---

## NFR-057 — Same Contracts

**Priority:** P0  
**Status:** domain repository interfaces `Implemented`
(`packages/domain/src/repositories`); application layer and DTO contracts
`Planned (B0)` (ADR-001, ADR-002); in-memory implementations `Planned (FE)`

### Target

Real and in-memory implementations satisfy the same domain repository
interfaces and return the same `@trading/contracts` DTOs through the same
presenters (ADR-001 point 4; ADR-002 point 5).

### Measurement

`pnpm typecheck` passes with both implementations typed against the same
interfaces; application services are unit-tested with in-memory
repositories (ADR-001 point 7).

---

## NFR-058 — Demo Isolation

**Priority:** P1  
**Status:** import boundary `Planned (B0)` (ADR-001 point 1; the rule in
`eslint.config.js` is a placeholder today); demo composition root
`Planned (FE)`

### Target

- `@trading/application` imports no Prisma, Express, Zod transport schema
  or browser API, enforced by lint rules (ADR-001 point 1).
- Demo-only code (in-memory repositories, simulation controls, failure
  injection) lives only behind the demo composition root (ADR-001 point 4);
  the API build contains 0 demo modules.

### Measurement

`pnpm lint` fails on a forbidden import; a check of the API `dist` finds no
demo module.

---

# 20. Data Simulation Quality

## NFR-059 — Realistic Dataset

**Priority:** P1  
**Status:** real-mode seed `Implemented` (`packages/database/src/seed`);
deterministic simulator `Planned (B5)` (ADR-007 point 7); demo dataset
`Deferred` (ADR-010 point 6)

### Target

- Every seeded record references existing parents (portfolio, positions,
  assets, transactions, decisions, scenarios), enforced by database
  foreign keys.
- The simulator is deterministic: the same seed and clock produce the same
  price series (ADR-007 point 7).

### Measurement

`pnpm --filter @trading/database db:seed` completes against the migrated
schema with no constraint violation; a `@trading/market-sim` test asserts
identical output for identical seed and clock.

---

## NFR-060 — Edge Cases

**Priority:** P1  
**Status:** `Deferred` — demo data is decided in the frontend-stage demo
ADR (ADR-010 point 6)

### Target

When that ADR lands, the dataset covers at least one case of each: empty
state, negative performance, positive performance, extreme values, missing
optional data, a large dataset (at least 1,000 transactions)
and a failed operation.

### Measurement

A checklist in `12-demo-mode-spec.md` maps each edge case to a seeded
record or scenario.

---

# 21. UX Quality

## NFR-061 — Perceived Performance

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

- Every user action shows visible feedback within 100 ms.
- Loading states (skeletons, optimistic updates, progressive rendering)
  reflect real application state; an optimistic update is rolled back on
  failure.

### Measurement

UI tests assert the loading state and the rollback path; manual check with
Chrome DevTools at 4x CPU throttling.

---

## NFR-062 — Motion Performance

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Animations change only `transform` and `opacity`; no animation triggers
layout.

### Measurement

A Chrome DevTools Performance recording of the main flows shows no layout
during animations; animated properties are checked in review.

---

# 22. Browser Compatibility

## NFR-063 — Modern Browser Support

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

The last 2 major versions of Chrome/Chromium, Firefox, Safari
and Edge.

### Accepted exception

No legacy browser support or polyfills (ADR-007 rejects transports a modern
browser target does not need).

### Measurement

The build `browserslist` matches the target; the end-to-end suite runs on
Chromium, Firefox and WebKit.

---

# 23. SEO and Public Surface

## NFR-064 — Public Project Pages

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

The demo entry page has a title, description, Open Graph tags, a canonical
URL, one `h1` and semantic landmarks.

### Accepted exception

SEO is limited to the static demo entry (ADR-006 point 1); there is no
server rendering and no public backend (ADR-006 point 2).

### Measurement

Lighthouse SEO score of at least 90 on the demo build.

---

## NFR-065 — Private Application Surface

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Screens behind login are not indexed; the public project page and the demo
have separate purposes.

### Measurement

Application routes carry `noindex`, asserted by an end-to-end test.

---

# 24. Internationalization

## NFR-066 — Localization Support

**Priority:** P1  
**Status:** `Planned (FE)` (ADR-010 point 8); language validation in preferences `Planned (B0)`; further languages `Deferred`

### Target

- Version 1 ships complete in English (`en`) and Spanish (`es`): every
  user-facing string, including validation and error messages, exists in
  both catalogs.
- User-facing strings live outside domain and application code; those layers
  return codes and data, never display text. The client maps API error
  `code` values to localized messages.
- Dates and numbers are formatted with the active locale (`Intl`).

### Measurement

- A test fails when a key exists in one catalog and not in the other.
- 0 user-facing string literals in `@trading/domain` and
  `@trading/application`, checked in review.

---

# 25. Cost Constraints

## NFR-067 — Zero Required Operating Cost

**Priority:** P0  
**Status:** `Implemented` (local stack, seeded data, no paid dependency);
demo `Planned (FE)` (ADR-006)

### Target

No hard dependency on paid market data, databases, authentication,
observability, AI APIs or real-time infrastructure.

### Accepted exception

No paid infrastructure and no hosted backend (ADR-006 point 2); market data
is simulated (ADR-007 point 7).

### Measurement

The dependency and deployment inventory lists no paid service (NFR-052,
NFR-053).

---

## NFR-068 — Graceful Free-Tier Degradation

**Priority:** P1  
**Status:** `Reference` — version 1 uses no free-tier service with usage
limits (ADR-006 points 1-2)

### Target

If a limited free service is ever added, it degrades (lower update rate,
smaller dataset, cached data) instead of failing.

### Measurement

Not applicable until a new ADR adds such a service.

---

# 26. Portfolio Engineering Quality

## NFR-069 — Defensible Architecture

**Priority:** P0  
**Status:** `Implemented` (`docs/adr/`, ADR-001 to ADR-010)

### Target

Every significant decision has an ADR with context, decision, consequences
and alternatives considered (`docs/adr/template.md`).

### Measurement

Every decision cited by an SDD document resolves to an accepted ADR;
`pnpm docs:check` passes.

---

## NFR-070 — Avoid Artificial Complexity

**Priority:** P0  
**Status:** `Reference` (applied in code and ADRs, for example ADR-008 and
ADR-009)

### Target

No microservices, event buses, distributed systems, advanced
infrastructure or libraries without a concrete requirement.

### Measurement

Each new dependency or infrastructure component cites the requirement or
ADR that needs it.

---

## NFR-071 — Evolution Readiness

**Priority:** P1  
**Status:** `Reference`

### Target

Ports allow later evolution without building it now: simulated to real
market data, one instance to several, local to production observability,
basic to advanced analytics.

### Measurement

Each evolution path needs a new adapter and an ADR, not a domain rewrite.

---

# 27. Quality Gates

**Status:** per gate below. Only gates marked `Implemented` run today.

| Gate | Where | Status |
| --- | --- | --- |
| `eslint --fix` and `prettier --write` on staged files | Husky pre-commit (lint-staged) | `Implemented` |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | Manual | `Implemented` |
| `pnpm test` (domain, database and API suites) | Manual | `Implemented` |
| `pnpm docs:check` | Manual | `Implemented` |
| Lockfile install, typecheck, lint, domain, database and API suites on pushes and pull requests to `develop` and `main` | GitHub Actions | `Planned (B0)` (ADR-006 point 10) |
| Application import boundary rule | `pnpm lint` | `Planned (B0)` (ADR-001 point 1) |
| Security checklist; smoke test under container limits | B7 | `Planned (B7)` |
| Accessibility, performance and end-to-end checks of the web app and demo | Frontend stage | `Planned (FE)` |

### Release criteria

Version 1 is complete when every P0 NFR meets its measurement and every
gate above runs. Demo-specific criteria (reproducible error states, reset)
are `Deferred` until the frontend-stage demo ADR (ADR-010 point 6).

---

# 28. Non-Functional Success Criteria

**Status:** `Reference`

The system should show that it is fast, reliable, secure, accessible,
maintainable, testable, observable and cost-efficient without unnecessary
infrastructure complexity.

The target is not the largest possible system; it is **sound engineering
judgment**.

---

# 29. Engineering Quality Model

**Status:** `Reference`

```text
              PRODUCT VALUE
                   ▲
       ┌───────────┼───────────┐
   UX QUALITY   ENGINEERING   RELIABILITY
       └───────────┼───────────┘
             SUSTAINABILITY
```

A sophisticated architecture with a poor user experience is not a success;
neither is an attractive interface on a fragile architecture. The system
must balance both.

---

# 30. Final Principle

**Status:** `Reference`

Non-functional requirements constrain engineering decisions; they do not
justify complexity.

> **What problem are we solving, what constraint does it create, and what is the simplest architecture that solves it well?**
