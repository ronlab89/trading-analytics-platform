# SDD 10 — Testing Strategy

**Project:** Trading Analytics Platform  
**Status:** All sections reconciled with the code and ADRs on 2026-10-06  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`, `08-realtime-spec.md`, `09-security-spec.md`

---

# 1. Purpose

**Status:** `Reference`

This document defines the testing strategy for Trading Analytics Platform.

Testing must verify not only that individual functions work, but that the complete product behaves correctly across:

- user flows;
- business rules;
- API communication;
- validation;
- authentication;
- authorization;
- realtime updates;
- background processes;
- simulation;
- error recovery;
- animations and transitions where behaviorally relevant;
- responsive interactions;
- accessibility;
- performance-critical scenarios.

The public demo must be fully functional despite using mock infrastructure.

Each section carries a status (see [`README.md`](README.md#status-legend)). Today only the backend has tests: Vitest in `@trading/domain`, `@trading/database` and `@trading/api`. There is no frontend, so everything about components, forms, UI states and demo mode is `Planned (FE)` or `Deferred`. Backend blocks B0-B7 come first (ADR-001, `15-implementation-plan.md`).

---

# 2. Testing Philosophy

**Status:** `Reference`

The project follows a risk-based testing strategy.

Testing effort should increase with:

- business impact;
- architectural complexity;
- frequency of execution;
- security sensitivity;
- realtime sensitivity;
- likelihood of regression.

The objective is not maximum test count.

The objective is **high confidence in important product behavior**.

Version 1 has no coverage threshold (ADR-006 point 11), and no coverage provider is configured in any Vitest config. A numeric target stays `Deferred`. The quality bar is the named mandatory tests: application services with in-memory fakes (ADR-001 point 7) and contract tests (ADR-002 point 6). Risk decides where other tests are added, not a percentage (§55).

---

# 3. Testing Pyramid

**Status:** unit and integration levels `Implemented` (backend); component and E2E levels `Planned (FE)`; their tooling `Deferred` to the frontend-stage ADR (ADR-006 point 11)

The project should follow:

```text
                 ┌─────────────────────┐
                 │   E2E / Playwright   │
                 │  Critical User Flows │
                 └──────────┬──────────┘
                            │
                 ┌──────────▼──────────┐
                 │ Integration Tests   │
                 │ API / DB / Realtime │
                 └──────────┬──────────┘
                            │
              ┌─────────────▼─────────────┐
              │     Component Tests       │
              │ React + User Interaction  │
              └─────────────┬─────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │              Unit Tests                │
        │ Domain / Services / Utilities / Rules  │
        └───────────────────────────────────────┘
```

Most tests should exist at the unit and component levels.

A smaller number of integration and E2E tests should validate complete system behavior.

Current shape, by file count: domain unit tests 28 files, database repository tests 17 files, API HTTP integration tests 14 files. The backend therefore leans on integration tests more than the pyramid asks, because application services do not exist as a separate layer yet (§6, ADR-001 point 7). The names "Playwright", "React" and "Testing Library" in this document are working assumptions: component and end-to-end tooling is decided in the frontend-stage ADR and stays `Deferred` until then (ADR-006 point 11, `04-tech-stack.md` §33).

---

# 4. Testing Layers

**Status:** layers 1, 2 and 4 `Implemented` (backend); layers 3 and 5 `Planned (FE)`; specialized testing follows the sections named below

The project uses five primary testing layers:

1. Static verification
2. Unit testing
3. Component testing
4. Integration testing
5. End-to-end testing

Additional specialized testing covers:

- security;
- accessibility;
- realtime behavior;
- performance;
- simulation determinism.

| Specialized testing | Section | Status |
| --- | --- | --- |
| Security | `09-security-spec.md` §55; §29-§31 | partial `Implemented` (ownership, auth, rate limit); rest by block |
| Accessibility | §36 | `Planned (FE)` |
| Realtime | §21-§23, §40 | `Planned (B5)` server; `Planned (FE)` client |
| Performance | §39-§42 | `Planned (FE)` client; `Planned (B5)` server limits; no load test |
| Simulation determinism | §20 | `Planned (B5)` |

---

# 5. Static Verification

**Status:** local checks `Implemented`; CI gate `Planned (B0)` (ADR-006 points 10-11)

Every change should pass:

```text
TypeScript
   ↓
Lint
   ↓
Formatting Check
   ↓
Build
```

Required checks:

- TypeScript type checking;
- ESLint;
- Prettier validation;
- production build.

Static checks should run before automated behavioral tests in CI.

What exists:

| Check | Command | Where it runs today |
| --- | --- | --- |
| TypeScript | `pnpm typecheck` (`tsc --build`) | manual |
| ESLint | `pnpm lint` | manual; `eslint --fix` on staged `*.{ts,tsx,js,jsx}` in the husky pre-commit hook |
| Prettier | `pnpm format:check` | manual; `prettier --write` on staged files in the pre-commit hook |
| Build | `pnpm build` (`pnpm -r build`, `tsc --build`) | manual |
| Docs | `pnpm docs:check` | manual |

The pre-commit hook (`.husky/pre-commit`, `lint-staged`) formats and lints staged files only. It does not type-check or run tests.

Code vs ADR:

- No CI workflow exists (`.github/` holds only the pull request template). ADR-006 point 10 decides one GitHub Actions workflow on pushes and pull requests to `develop` and `main`: install with the lockfile, typecheck, lint, and the domain, database and API test suites, the latter two against a PostgreSQL service container. It is `Planned (B0)`.
- ADR-006 point 11 adds `pnpm format:check` and `pnpm build` to that workflow, so CI runs all four checks above (`Planned (B0)`). The build step proves the packages compile from a clean checkout; the compiled API does not yet run (`node dist/index.js` fails on extensionless imports; fixed in B7, ADR-006 point 3).
- The domain-boundary lint rule is commented out in `eslint.config.js` (`06-architecture.md` §43); it is `Planned (B0)` with the lint-enforced boundaries of ADR-002.

---

# 6. Unit Testing

**Status:** domain `Implemented`; application services with in-memory fakes `Planned (B0)` (ADR-001 point 7); web utilities `Planned (FE)`

Vitest is the primary unit testing framework.

Unit tests should focus on deterministic logic with minimal infrastructure.

Priority areas:

- domain entities;
- calculations;
- validation;
- portfolio metrics;
- transaction rules;
- permission rules;
- simulation logic;
- formatting utilities;
- state transformations;
- event normalization.

Today `packages/domain/src` holds 28 test files (about 250 cases) next to the code (`*.test.ts`), run by `vitest run` in the `node` environment (`packages/domain/vitest.config.ts`). They need no database and no environment file.

Code vs ADR: services in `apps/api/src/services` call Prisma repositories directly and are exercised only through HTTP (§16). ADR-001 moves them to `@trading/application`, unit-tested with in-memory fake repositories, in B0. Permission rules (ADR-005) are `Planned (B0)`/`Planned (B2)` and have no tests yet. Simulation logic is `Planned (B5)` (§20). Formatting utilities and state transformations belong to the frontend (`Planned (FE)`).

---

# 7. Domain Testing

**Status:** `Implemented`, with one gap

Domain logic must have strong unit-test coverage.

Examples include:

```text
Portfolio valuation
Position calculation
Profit / loss calculation
Allocation percentages
Transaction validation
Risk calculations
Alert conditions
Scenario calculations
```

Domain tests should not require React, Express, PostgreSQL, or browser APIs.

Covered today: entities (16 files), `Money`, and calculations for allocation, attribution, drawdown, volatility, portfolio metrics, portfolio pulse, daily change, position metrics, scenario impact and comparison, and decision replay. These tests import nothing but the domain.

Gap: `calculatePositionAfterTransaction` (`position-recalculation.ts`, the oversell and average-cost rule) has no domain unit test; it is covered only through `transactions.routes.test.ts`. A unit test for it, including the chronological rule of ADR-003 point 6, is `Planned (B0)` because B0 moves that logic into the application layer and fixes the lost-update race (ADR-001 Deferred detail). The two B0 rows of ADR-002 (`decision-replay.ts` string money, and `scenario-impact.ts` exact percentage factor with an exact-result test for `-12.3`) also add domain tests in B0.

---

# 8. Business Rule Testing

**Status:** `Implemented` through API tests and entity tests; chronological validation `Planned (B0)` (ADR-003 point 6)

Business rules should be tested through explicit examples.

Example:

```text
Given:
  portfolio holds 10 units of asset A

When:
  a SELL of 6 units is created

Then:
  transaction is accepted
```

And:

```text
Given:
  portfolio holds 10 units of asset A

When:
  a SELL of 12 units is created

Then:
  transaction is rejected (InsufficientPositionQuantityError)
```

Both valid and invalid paths must be tested.

Code vs ADR: the previous example compared a transaction value with a "portfolio balance". ADR-003 point 3 removes cash from version 1 (no balance, no "insufficient cash" validation); the equivalent rule is oversell, as above. A backdated `SELL` that would make an earlier historical holding negative must also be rejected (ADR-003 point 6); the code checks only the current position, so this case is `Planned (B0)` and needs its own test.

---

# 9. Boundary Testing

**Status:** `Implemented` for money and metrics; the rest `Planned` with the block that owns the calculation

Important calculations must test boundary values.

Examples:

- zero;
- minimum allowed value;
- maximum allowed value;
- exact available quantity;
- quantity above available holding;
- empty datasets;
- one item;
- large datasets;
- negative values where prohibited;
- decimal precision.

"Exact available balance" now reads "exact available quantity" (ADR-003). Decimal precision uses `decimal.js` (`Money` and ADR-002 point 9). Analytics edge cases (first and last day, one price point, zero denominators, rounding) are specified in `16-analytics-spec.md` and tested in B1 (ADR-004).

---

# 10. Component Testing

**Status:** `Planned (FE)`; tooling `Deferred` to the frontend-stage ADR (ADR-006 point 11)

Testing Library should be used for React component behavior.

Tests should simulate user behavior rather than internal implementation details.

Examples:

```text
click
type
select
submit
toggle
navigate
retry
cancel
confirm
```

The test should verify the resulting user-visible behavior.

No `apps/web` code or component test setup exists (`apps/web` holds only wireframe files). React and Testing Library are the intended choice; the component test runner and React Testing Library are decided in the frontend-stage ADR (ADR-006 point 11).

---

# 11. Component Test Priorities

**Status:** `Planned (FE)`

High-value components include:

- portfolio selector;
- transaction forms;
- filters;
- data tables;
- charts;
- alerts;
- dialogs;
- notification center;
- realtime status indicator;
- simulation controls;
- scenario panels;
- authentication UI.

Purely visual primitives do not require exhaustive individual tests when their behavior is already covered through composed components.

The list follows `11-ui-ux-spec.md` and is refined when the frontend blocks are defined in `15-implementation-plan.md`.

---

# 12. Form Testing

**Status:** `Planned (FE)`

Forms must test:

- initial state;
- valid submission;
- required fields;
- invalid formats;
- boundary values;
- server validation errors;
- duplicate submissions;
- loading state;
- successful submission;
- cancellation;
- reset behavior.

Example:

```text
User
 ↓
Fill form
 ↓
Submit
 ↓
Validation
 ↓
API
 ↓
Success / Error
 ↓
UI Feedback
```

"Server validation errors" are shaped by the API contract: `VALIDATION_ERROR` with `{ field, message }` details (ADR-002 point 10, `07-api-spec.md`). The backend half of this list (invalid formats, boundaries, required fields) is already tested through `validate.test.ts` and the route tests.

"Duplicate submissions" on the server side relates to idempotency, which exists only for CSV import (ADR-008, `Planned (B4)`).

---

# 13. Error State Testing

**Status:** server-side error responses `Implemented` (401, 404, 409, 429 paths in route tests; 403 `Planned (B2)`, no check raises it yet); UI states `Planned (FE)`

Every major asynchronous operation should have tests for:

```text
Idle
Loading
Success
Empty
Error
Retrying
Recovered
```

Where applicable:

```text
Timeout
Unauthorized
Forbidden
Conflict
Rate Limited
Network Offline
```

The UI must provide an intentional experience for each state.

Backend today: `rate-limit.test.ts`, `auth.routes.test.ts` and the ownership tests cover Unauthorized, Forbidden-as-404 (ADR-005, `09` §14-15), Conflict and Rate Limited responses. The API has no server timeout (ADR-002 point 10), so "Timeout" is a client-side state only (`Planned (FE)`). "Network Offline" and "Retrying" are frontend states; the realtime reconnect states are tested under §21 (`Planned (B5)`).

---

# 14. Loading State Testing

**Status:** `Planned (FE)`

Loading states must be tested as behavior.

Examples:

- submit button disabled during request;
- duplicate submission prevented;
- skeleton displayed;
- progress indicator updated;
- stale data behavior remains intentional;
- loading state clears after success or failure.

The only backend-driven progress is the CSV import job (`progress` in ADR-008, `Planned (B4)`), whose polling and realtime updates are tested with the job.

---

# 15. Empty State Testing

**Status:** `Planned (FE)`

The application must distinguish between:

```text
No data exists
```

and:

```text
Data failed to load
```

Empty-state tests should verify that the correct message and action are displayed.

The backend side of this distinction is already testable: a list endpoint returns an empty `data` array with `200`, while a failure returns the error envelope. Route tests cover empty lists for the main resources; the frontend tests assert how each case is shown.

---

# 16. API Integration Testing

**Status:** `Implemented`; `@trading/contracts` contract tests `Planned (B0)` (ADR-002 point 6)

API integration tests should verify the interaction between:

```text
HTTP
 ↓
Middleware
 ↓
Validation
 ↓
Application Service
 ↓
Repository
```

Tests should cover:

- request validation;
- response structure;
- status codes;
- authentication;
- authorization;
- business errors;
- persistence behavior.

Today 14 files in `apps/api/src` (`app.test.ts`, `middleware/*.test.ts`, `routes/*.routes.test.ts`) run Supertest against `createApp()` and a real PostgreSQL database. They sign tokens with the test `JWT_SECRET`, create users and portfolios through `test-utils/fixtures.ts` and clean up after themselves. `pnpm test` in `apps/api` loads `.env.test.local` through `dotenv-cli`.

Code vs ADR:

- The "Application Service" step is the current `apps/api/src/services` code. ADR-001 replaces it with the shared application layer in B0; ADR-001 point 7 keeps these HTTP tests as they are.
- ADR-002 point 6 turns the same tests into contract tests that validate responses against the `@trading/contracts` Zod schemas. Until B0 they assert shape by hand.
- Route-parameter validation, `VALIDATION_ERROR` for a malformed ID and `404` for an unknown or foreign ID are `Planned (B0)` (ADR-002 point 10); tests are added with them.
- Authorization tests today check ownership and the roles `USER` and `ADMIN`; permission-based roles are `Planned (B0)` and `Planned (B2)` (ADR-005), with their tests.
- Tests that need a database cannot run without PostgreSQL and `.env.test.local`; the CI service container is `Planned (B0)` (ADR-006 point 10).

---

# 17. Repository Testing

**Status:** `Implemented`

Repositories should be tested independently from application services.

When using PostgreSQL:

- migrations must be applied;
- queries must execute against a controlled test database;
- relationships must be verified;
- transaction behavior must be tested.

Repository tests must not depend on production data.

Today 17 files in `packages/database/src` (one per Prisma repository plus `prisma-unit-of-work.test.ts`) run against the PostgreSQL instance named by `.env.test.local`. Each test creates and removes its own rows. `pnpm test` in `packages/database` loads that file through `dotenv-cli`.

Code vs ADR: ADR-001 requires the `UnitOfWork` contract to guarantee isolation for position updates, with a concurrent-`SELL` test (two `SELL` of 6 on a holding of 10 must not both succeed). That test does not exist; it is `Planned (B0)`. Applying migrations before the suite is a manual step today (`pnpm --filter @trading/database db:test:migrate`); the CI service container applies them automatically (`Planned (B0)`).

---

# 18. Mock Repository Testing

**Status:** `Planned (B0)` for the in-memory fakes and the shared contract suite; demo use `Planned (FE)`

Mock repositories must implement the same contracts as production repositories.

Tests should verify behavioral equivalence for important operations.

Example:

```text
ProductionRepository
        │
        ├── createPortfolio()
        ├── getPortfolio()
        └── updatePortfolio()

MockRepository
        │
        ├── createPortfolio()
        ├── getPortfolio()
        └── updatePortfolio()
```

The frontend must not need different business logic because the repository is mocked.

No in-memory repository exists yet. ADR-001 decides that the fakes written for application-service tests (point 7) are the starting point for the demo's mock repositories (point 4, its own composition root), and that `UnitOfWork` also gets an in-memory implementation with rollback. Behavioral equivalence is checked by one repository contract suite that runs against both the Prisma and the in-memory implementation; the Prisma side is already covered by §17 tests, so the suite is extracted from them in B0.

Code vs ADR: the in-memory `UnitOfWork` must serialize units or roll back only its own writes, so an interleaved rollback cannot erase another unit's committed write (ADR-001 Deferred detail, B0, with its own test).

---

# 19. Demo Mode Testing

**Status:** `Planned (FE)`

The public demo is a first-class application mode.

It must not be treated as a simplified visual prototype.

Demo Mode must support:

- navigation;
- authentication simulation;
- portfolio management;
- transactions;
- analytics;
- tables;
- charts;
- realtime simulation;
- alerts;
- background processes;
- errors;
- retries;
- validation;
- transitions;
- notifications.

The demo runs the application layer in process on in-memory repositories (ADR-001, ADR-006 point 7), so it is tested with the same application-service tests as the backend plus frontend component and end-to-end tests. Demo data layers and reset are not decided (`Deferred`, `05-data-model.md` §34-37; ADR-007 point 15 leaves reset to the frontend-stage demo ADR). The demo scope itself is in `12-demo-mode-spec.md`.

---

# 20. Demo Simulation Testing

**Status:** `Planned (B5)` for the shared engine; demo wiring `Planned (FE)`

The simulation engine must be deterministic when a seed is supplied.

Example:

```text
Seed A
   ↓
Simulation
   ↓
Event Sequence A
```

Running again with the same seed should produce the same sequence where deterministic behavior is expected.

This makes simulations reproducible during testing and interviews.

No simulation engine exists. ADR-007 point 7 decides a pure `@trading/market-sim` package with a seeded pseudo-random generator and an injected clock, shared by real and demo modes, so one test suite covers both. Determinism tests belong to that package in B5: same seed and clock give the same event sequence; different seeds differ; sequence numbers per asset are gapless and restart correctly from persisted state (ADR-007 Deferred detail).

---

# 21. Realtime Testing

**Status:** server `Planned (B5)`; client `Planned (FE)` (ADR-007, `08-realtime-spec.md` §59)

Realtime behavior must be tested independently from visual rendering.

Tests should cover:

- connection;
- authentication;
- subscription;
- event reception;
- event validation;
- ordering;
- deduplication;
- disconnection;
- reconnection;
- stale events;
- unauthorized subscriptions.

No realtime code exists yet: there is no `ws` dependency, no WebSocket server and no realtime client, so none of these cases has a test. The detailed case list lives in `08-realtime-spec.md` §59 (realtime view) and `09-security-spec.md` §55 (security view). This section maps the list above to them:

| Topic | Rule under test | Block |
| --- | --- | --- |
| Connection, heartbeat, limits | Ping every 30 s, close after 2 missed pongs; 50 subscriptions and 20 inbound messages per second per connection; 1 MB outbound buffer; at most 5 connections per user; a limit breach closes with `4008` (ADR-007 points 11 and 15-16, ADR-005 point 13) | B5 |
| Authentication | Token in the first `AUTHENTICATE` message, never in the URL; no authentication within 5 s closes `4001`; expired token without re-authentication closes `4002`; re-authentication with another `sub` closes the socket (ADR-007 point 2 and Deferred detail) | B5 |
| Subscription | `SUBSCRIBE` and `UNSUBSCRIBE` answered with `ACK` or `ERROR` (with a `code`) on `market:{assetId}`, `portfolio:{portfolioId}`, `jobs:{jobId}` and `notifications` (ADR-007 points 3 and 15, ADR-008 point 11) | B5 |
| Unauthorized subscription | Refused like an unknown channel, so existence is not revealed, and logged as `authz.denied` (ADR-005 point 12, ADR-009 point 9) | B5 |
| Event validation | Every event matches its `@trading/contracts` schema; money is a decimal string (ADR-002, ADR-007 point 4) | B5 server; FE client drops invalid events |
| Ordering, gaps | `sequence` is monotonic per channel; a gap or an epoch change triggers HTTP resynchronization; there is no replay buffer (ADR-007 point 5) | B5 server; FE client |
| Deduplication, stale events | Events with an already-seen `sequence` are discarded (NFR-018) | FE |
| Disconnection, reconnection | §23 | FE, server close codes B5 |

Event names are those of the version 1 catalog: `MARKET_PRICE_UPDATED`, `PORTFOLIO_UPDATED`, `NOTIFICATION_CREATED`, `ALERT_TRIGGERED` (ADR-007 point 6) and `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED`, `JOB_FAILED` (ADR-008 point 11). There is no transaction or position event to test. Tests use the injected clock and the seeded engine, never wall time (`08-realtime-spec.md` §59).

---

# 22. Realtime UI Testing

**Status:** `Planned (FE)` (NFR-004, NFR-005, NFR-006)

The UI should react correctly to realtime events.

Example:

```text
Price Event
    ↓
State Update
    ↓
Affected Components
    ↓
Minimal Re-render
    ↓
Visible Update
```

Tests should verify that the correct data changes without requiring a full page reload.

What the tests assert, through the realtime transport test double (`08-realtime-spec.md` §42-43):

- A `MARKET_PRICE_UPDATED` event re-renders only components that show that asset or a value derived from it, counted with render counting (NFR-005).
- The client recomputes valuations from prices; the server pushes no valuation per tick (ADR-007 point 6). `PORTFOLIO_UPDATED` arrives only after a transaction commits.
- A burst of 100 events in 1 s is applied in at most one render per animation frame (NFR-006); the new price is visible within 100 ms of receipt (NFR-004, §40).
- Update highlights are disabled under reduced motion (`08-realtime-spec.md` §49, NFR-032).

The component test tooling is `Deferred` to the frontend-stage ADR (ADR-006 point 11).

---

# 23. Reconnection Testing

**Status:** client `Planned (FE)`; server close codes and heartbeat `Planned (B5)` (NFR-018, `08-realtime-spec.md` §7 and §26-30)

The application must recover from temporary realtime failures.

Test scenario, using the client connection states of `08-realtime-spec.md` §6-7:

```text
CONNECTED
   ↓  socket lost without a close code, or closed with 1001
RECONNECTING  (backoff 1 s, 2 s, 4 s ... capped at 30 s, with jitter)
   ↓
CONNECTED     (AUTHENTICATE first, each subscription restored once)
   ↓
Resynchronize state through HTTP

RECONNECTING → FAILED → CONNECTING   (manual retry)
CONNECTED    → DISCONNECTED          (intentional close: no reconnection)
```

The user should receive appropriate feedback.

Feedback is the stale-data indicator of `08-realtime-spec.md` §28: subtle while `CONNECTING`, `RECONNECTING` or `DISCONNECTED`, and a persistent warning with a retry action in `FAILED`. Connection changes create no notification (ADR-010 point 9). While the socket is down the client polls HTTP every 10 s and stops on reconnect (ADR-007 points 12 and 15).

Further cases: a `4002` close refreshes the token and then reconnects (`08-realtime-spec.md` §54); a sequence gap or a new epoch after a server restart triggers resynchronization (§26 of that spec). The previous diagram used ad hoc state names and had no `FAILED` path.

---

# 24. Background Process Testing

**Status:** job runner `Planned (B4)`; job events `Planned (B5)`; demo jobs `Planned (FE)` (ADR-008)

Background processes should be tested through state transitions.

The only background job in version 1 is the CSV transaction import (ADR-008 point 1). Its states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` and `TIMED_OUT`; progress is a field, not a state (ADR-008 point 3). No job code or `jobs` table exists yet.

Success path:

```text
QUEUED
 ↓
PROCESSING   (validate every row, progress { processed, total }; then apply in one UnitOfWork)
 ↓
COMPLETED    (set in the same database transaction as the imported rows)
```

Failure paths:

```text
PROCESSING (validation) → FAILED, reason VALIDATION_FAILED   (nothing written; not retryable)
PROCESSING (apply)      → FAILED, reason APPLY_REJECTED or APPLY_ERROR
server restart          → PROCESSING becomes FAILED, reason INTERRUPTED; QUEUED jobs resume
```

Timeout and cancellation paths:

```text
QUEUED or validating → TIMED_OUT    (timeout per attempt; the apply stage is exempt)
QUEUED or validating → CANCELLED    (never during apply)
TIMED_OUT, CANCELLED, FAILED (INTERRUPTED, APPLY_ERROR, APPLY_REJECTED)
                     → retry → QUEUED, attempt + 1
```

The exact states must follow the realtime and functional requirements.

Tests in B4 also cover: retry or cancel in a state that does not allow it returns 409 `CONFLICT` and changes nothing (ADR-008 point 6); creating an import on an archived portfolio returns 409 (ADR-010 point 5); `COMPLETED` creates a `SUCCESS` notification, `FAILED` and `TIMED_OUT` an `ERROR` one, `CANCELLED` none; every transition is a compare-and-set (ADR-008 Deferred detail). In B5, only `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED` and `JOB_FAILED` are emitted on `jobs:{jobId}`; `CANCELLED` and `TIMED_OUT` emit no event (ADR-007 point 15).

`Idempotency-Key` on transaction and import creation is tested independently of jobs (ADR-008 point 8, `Planned (B4)`): same key and request return the stored response; same key with another request returns 409.

Code vs ADR: the previous diagrams used `Running`, a `Progress` state and a `Timeout → Recovery` path. ADR-008 has no recovery state: `TIMED_OUT` is final until a retry returns the job to `QUEUED`.

---

# 25. Progress Testing

**Status:** `Planned (B4)`; progress display `Planned (FE)` (ADR-008 points 2-3)

Progress values must be validated.

Expected behavior, with `total` known once the file is parsed:

```text
{ processed: 0, total: 100 }
 ↓
{ processed: 25, total: 100 }
 ↓
...
 ↓
{ processed: 100, total: 100 }
```

The system must prevent:

- negative progress;
- values above 100%;
- impossible state transitions;
- completion before required work is finished.

Progress is `{ processed, total }`, not a percentage (`08-realtime-spec.md` §20); the UI may derive one. The rules above become: `0 ≤ processed ≤ total`, `processed` never decreases within an attempt, and `JOB_PROGRESS_UPDATED` is emitted only while `PROCESSING`. A job reaches `COMPLETED` only inside the apply transaction (ADR-008 point 5), so completion cannot precede the work. ADR-008 point 2 reports progress during validation; whether the apply stage also reports progress is an Open detail (B4).

---

# 26. Notification Testing

**Status:** read state, ownership and persistence `Implemented`; creation from alerts `Planned (B5)` and from jobs `Planned (B4)`; realtime delivery `Planned (B5)`; client `Planned (FE)`

Notifications should be tested for:

- creation;
- ordering;
- read/unread state;
- dismissal;
- duplicate prevention;
- realtime delivery;
- persistence where applicable.

| Case | Status |
| --- | --- |
| Read/unread: list with `unreadOnly`, mark one read, mark all read | `Implemented` (`notifications.routes.test.ts`, `prisma-notification-repository.test.ts`) |
| Another user's notification: 404, left unread; mark-all touches only the caller's | `Implemented` (`notifications.routes.test.ts`) |
| Persistence (repository create with and without metadata) | `Implemented` (`prisma-notification-repository.test.ts`) |
| Ordering | Gap: the repository orders by `createdAt` descending, but no test asserts it |
| Creation by a triggered alert (`WARNING`) | `Planned (B5)` (ADR-007 point 9) |
| Creation by an import job (`SUCCESS`, `ERROR`; none for `CANCELLED`) | `Planned (B4)` (ADR-008 point 6) |
| Duplicate prevention: edge-triggered alerts, no notification per tick, no re-fire after restart | `Planned (B5)` (ADR-007 point 9 and Deferred detail) |
| Realtime delivery: `NOTIFICATION_CREATED` and `ALERT_TRIGGERED` on `notifications` | `Planned (B5)` (ADR-007 point 15) |

Code vs ADR: dismissal is removed from version 1; a notification is only `unread` or `read` (ADR-010 point 3), so there is no dismissal test. Today no endpoint creates notifications; they come from the seed. Connection changes never create one (ADR-010 point 9).

---

# 27. Table Testing

**Status:** `Planned (FE)`; table library `Deferred` (`04-tech-stack.md` §12)

TanStack Table implementations should test:

- sorting;
- filtering;
- pagination;
- column visibility;
- row selection;
- empty results;
- large datasets;
- reset filters.

The test should focus on user-visible outcomes rather than TanStack Table internals.

TanStack Table is a candidate, not a decision (`04-tech-stack.md` §12). Scope limits from ADR-010:

- Sorting happens in the client, only for lists loaded in full; paginated lists keep the API order of FR-014 (point 4). A paginated table has no sort test.
- Column visibility and row selection are `Deferred` (point 9), so they are not tested in version 1.
- Large datasets follow §41.

---

# 28. Chart Testing

**Status:** calculated values `Implemented` in domain tests (§7); chart tests `Planned (FE)`; chart library `Deferred` (`04-tech-stack.md` §16)

Charts should be tested primarily through:

- data transformation;
- calculated values;
- loading state;
- empty state;
- error state;
- time-range selection;
- interaction behavior;
- realtime updates.

Pixel-perfect chart snapshots should not be the primary testing strategy.

The values a chart plots are computed in `@trading/domain` and the API and are already tested there (drawdown, volatility, allocation, attribution). Chart tests add:

- Period analytics charts change when a daily candle closes, not on every tick (FR-045, `08-realtime-spec.md` §50); only charts that plot ticks react to `MARKET_PRICE_UPDATED`, at most once per frame.
- Every chart has a text alternative (NFR-031).
- 5-year daily series meet NFR-008 (§41).

---

# 29. Authentication Testing

**Status:** login and token checks `Implemented`; expired token, refresh and logout `Planned (B2)`; login timing `Planned (B0)`; client lifecycle `Planned (FE)` (ADR-005)

Authentication tests must include:

### Success

- valid credentials;
- session creation;
- authenticated API request.

### Failure

- invalid credentials;
- malformed token;
- expired token;
- missing token.

### Lifecycle

- logout;
- session cleanup;
- cache cleanup;
- realtime disconnect.

| Case | Status |
| --- | --- |
| Valid credentials return a token that `GET /api/v1/auth/me` accepts | `Implemented` (`auth.routes.test.ts`) |
| Wrong password and unknown email return the same generic 401 | `Implemented` (`auth.routes.test.ts`) |
| Missing and malformed token on `/auth/me` return 401 | `Implemented` (`auth.routes.test.ts`) |
| Login rate limit (5 per 15 minutes) returns 429 with the error envelope | `Implemented` (`rate-limit.test.ts`, on an isolated limiter: the real limiters are disabled under `NODE_ENV=test`) |
| Expired token, wrong algorithm, unknown role return 401 | `Planned (B2)` |
| Missing account takes comparable time to a wrong password (dummy hash) | `Planned (B0)` (ADR-005 point 13) |
| Login response `{ user, session: { accessToken, expiresAt } }` | `Planned (B2)` (ADR-005 point 8) |
| Refresh rotation, reuse detection, parallel refresh, lost response | `Planned (B2)` (ADR-005 points 5-6 and Deferred detail) |
| Logout revokes the session and clears the cookie; custom header required | `Planned (B2)` (ADR-005 points 6-7) |
| Client clears cached data and closes the socket on logout | `Planned (FE)` (`08-realtime-spec.md` §54) |

Code vs ADR:

- Only `POST /api/v1/auth/login` and `GET /api/v1/auth/me` exist. There is no refresh and no logout endpoint, and no server-side session: "session creation" means issuing a 15-minute JWT returned as `token`. Sessions, refresh and logout are `Planned (B2)`; until then the logout flow of §33 cannot run.
- `jwt.verify` already rejects expired tokens, but no test proves it.
- After logout the access token stays valid until it expires (at most 15 minutes, ADR-005 point 6). The test asserts that the refresh family is revoked and that the client closes the socket, not that the access token stops working.
- Registration is out of scope (ADR-005 point 10).

---

# 30. Authorization Testing

**Status:** ownership `Implemented`; roles and permissions `Planned (B0)` (enforcement point) and `Planned (B2)` (role model) (ADR-005)

Authorization tests must include:

- allowed role;
- denied role;
- resource ownership;
- cross-user access;
- administrative access;
- privilege escalation attempts.

Example:

```text
User A
  ↓
Request Portfolio B
  ↓
Ownership Check
  ↓
404 (never 403)
```

Another user's resource returns 404, never 403, so its existence is not revealed (ADR-005 point 12). The previous diagram showed 403. Cross-user tests are `Implemented` in the `portfolios`, `alerts`, `decisions`, `notifications`, `preferences`, `scenarios` and `watchlist` route tests, and assert that nothing changed. Gap: `transactions.routes.test.ts` has no cross-user case (listing or creating transactions in another user's portfolio).

Roles: the code has `USER` and `ADMIN` (`UserRole`, default `USER`), and no route checks a role. ADR-005 replaces them with `VIEWER`, `TRADER` and `ADMIN`, checked as permissions in the application layer. Planned cases:

| Case | Expected | Block |
| --- | --- | --- |
| Allowed role | `TRADER` mutates own resources | B2 |
| Denied role | `VIEWER` mutating domain data gets 403 | B2 |
| `VIEWER` self-service | `VIEWER` may update its preferences and mark its notifications read (ADR-005 point 13) | B2 |
| Administrative access | `ADMIN` has only `simulation:control` beyond `TRADER`; start, pause and mode change need it | B5 |
| Escalation | A token with an unknown role is rejected with 401; role changes apply at the next refresh, within 15 minutes (ADR-005 point 9) | B2 |
| Same rules in API and demo | Use-case tests with an `Actor` run once for both (ADR-005 point 3) | B0 |

---

# 31. Security Testing

**Status:** partial `Implemented` (authentication, ownership, validation, rate limit); the rest by block, as listed in `09-security-spec.md` §55

Security behavior from `09-security-spec.md` must have automated coverage.

At minimum:

- authentication bypass attempts;
- unauthorized resource access;
- invalid input;
- malformed tokens;
- permission escalation;
- unauthorized realtime subscription;
- sensitive error exposure;
- session isolation.

`09-security-spec.md` §55 is the authoritative case list with a status per case. Mapping of the list above:

| Item | Status |
| --- | --- |
| Authentication bypass, malformed tokens | `Implemented` for missing and malformed tokens; expired token, wrong algorithm and unknown role `Planned (B2)` (§29) |
| Unauthorized resource access | `Implemented` (cross-user 404, §30) |
| Invalid input | `Implemented` (`validate.test.ts`, route tests); malformed path parameters and unexpected fields `Planned (B0)`; CSV input `Planned (B4)` |
| Permission escalation | `Planned (B2)` (§30) |
| Unauthorized realtime subscription | `Planned (B5)` (§21) |
| Sensitive error exposure | `Planned (B3)` (generic 500, redaction, ADR-009 points 4, 6 and 13) |
| Session isolation | `Planned (FE)` (`09-security-spec.md` §10) |

---

# 32. End-to-End Testing

**Status:** `Planned (FE)`; tooling `Deferred` to the frontend-stage ADR (ADR-006 point 11)

Playwright will be used for critical user journeys.

E2E tests should run against a realistic application environment.

They should validate:

```text
Browser
 ↓
Frontend
 ↓
API
 ↓
Database / Mock Infrastructure
```

depending on the test environment.

No frontend and no E2E suite exist. Playwright is a working assumption, not a decision: the frontend-stage ADR picks the E2E tool (ADR-006 point 11). There is no public backend (ADR-006 point 2), so the two E2E environments are the local production stack (browser → web → API → PostgreSQL) and the static demo, where the application layer runs in the browser on in-memory repositories (ADR-001, ADR-006 point 7) and there is no API.

---

# 33. Critical E2E Flows

**Status:** `Planned (FE)`; logout depends on `Planned (B2)`, CSV import on `Planned (B4)`, realtime on `Planned (B5)`

The following flows should have E2E coverage:

### Authentication

```text
Login
 ↓
Dashboard
 ↓
Logout
```

### Portfolio

```text
Create Portfolio
 ↓
View Portfolio
 ↓
Update Portfolio
```

### Transaction

```text
Create Transaction
 ↓
Validation
 ↓
Confirmation
 ↓
Updated Position
```

### Analytics

```text
Open Analytics
 ↓
Select Portfolio
 ↓
Change Time Range
 ↓
Charts / Metrics Update
```

### Realtime

```text
Open Dashboard
 ↓
Realtime Connection
 ↓
Market Update
 ↓
UI Update
```

### Failure Recovery

```text
Request
 ↓
Failure
 ↓
Error UI
 ↓
Retry
 ↓
Success
```

### CSV Transaction Import

```text
Upload CSV (with Idempotency-Key)
 ↓
Job QUEUED
 ↓
PROCESSING, progress { processed, total }
 ↓
COMPLETED (positions updated)  or  FAILED / TIMED_OUT
 ↓
Retry when allowed → QUEUED
```

Notes against the ADRs:

- **Authentication:** the logout step needs the B2 logout endpoint (§29).
- **Transaction:** creation is synchronous (ADR-008 point 12): the updated position is visible as soon as the request returns, with no job. A `SELL` above the held quantity, or an earlier date that would make history negative, fails validation (ADR-003 point 6). Any mutation on an archived portfolio returns 409 (ADR-010 point 5).
- **Realtime:** the market update arrives as `MARKET_PRICE_UPDATED` and the client recomputes values (ADR-007 point 6).
- **Failure recovery:** realtime failure shows the stale-data indicator, not an error page (`08-realtime-spec.md` §57).
- **CSV transaction import** (added 2026-10-06, approved by the user; `Planned (FE)`, server side `Planned (B4)`): CSV import is a P1 feature (ADR-008 point 1), so it is a critical flow. The test uploads a file through `POST /api/v1/portfolios/:portfolioId/imports`, follows progress `{ processed, total }` (§25), and asserts the final state: `COMPLETED` with the rows applied, or `FAILED` with a per-row report and nothing written (ADR-008 point 2). Repeating the upload with the same `Idempotency-Key` returns the stored response and creates no second job (point 8). Retry is offered only where ADR-008 point 6 allows it; a `VALIDATION_FAILED` job is not retryable and the user uploads a corrected file.

---

# 34. Demo-Specific E2E Flows

**Status:** `Planned (FE)`; reset and scripted failures `Deferred` (ADR-010 point 6)

Because the public demo is central to the portfolio, it requires additional E2E coverage.

At minimum:

- demo entry;
- demo user selection;
- simulated login;
- portfolio switching;
- market simulation;
- realtime price changes;
- alerts;
- background process execution;
- intentional failure scenario;
- retry/recovery;
- notifications;
- logout/reset.

How each item maps to the decisions:

| Item | Decision | Status |
| --- | --- | --- |
| Demo entry, simulated login | Controlled demo identity, no registration (ADR-005 points 10-11) | `Planned (FE)` |
| Demo user selection | Role selector `Viewer`, `Trader`, `Admin`, through the same permission checks as the API (ADR-005 points 3 and 11) | `Planned (FE)` |
| Portfolio switching, market simulation, realtime price changes | `@trading/market-sim` in the browser, behind the same client-side realtime port (ADR-007 points 7 and 13) | `Planned (FE)` |
| Alerts | Edge-triggered: one trigger per false-to-true change (ADR-007 point 9) | `Planned (FE)` |
| Background process execution | The CSV import use case in process, with simulated progress (ADR-008 point 13) | `Planned (FE)` |
| Intentional failure scenario, retry/recovery | Injectable job failures exist (ADR-008 point 13); scripted failures and simulated latency are `Deferred` | partly `Deferred` |
| Notifications | `unread` or `read` only; no dismissal (ADR-010 point 3) | `Planned (FE)` |
| Logout/reset | Logout `Planned (FE)`; reset `Deferred` | partly `Deferred` |

Demo data layers, reset, simulated latency and scripted failures wait for the frontend-stage demo ADR (ADR-010 point 6); their E2E flows are written with it.

---

# 35. E2E Test Data

**Status:** backend test data `Implemented`; E2E data `Planned (FE)`

E2E tests must use controlled test data.

Tests should not depend on:

- external financial APIs;
- real market data;
- production databases;
- real user accounts;
- external paid services.

The test environment must be reproducible.

Today the API and database tests create their own data through `apps/api/src/test-utils/fixtures.ts` and the repositories, against a local PostgreSQL test database (`.env.test.example`); nothing calls an external service. All market data is synthetic (ADR-007 point 8): the seed is `MOCK` data with dates relative to the seed run, so E2E assertions must not depend on fixed calendar dates. E2E runs fix the simulator seed and the injected clock (ADR-007 point 7) so price sequences repeat.

---

# 36. Accessibility Testing

**Status:** `Planned (FE)` (NFR-029 to NFR-032); scanning tool `Deferred` to the frontend-stage ADR (ADR-006 point 11, `04-tech-stack.md` §33)

Accessibility is part of product quality.

Tests should cover:

- keyboard navigation;
- focus management;
- accessible names;
- form labels;
- dialog behavior;
- error announcements;
- semantic structure;
- reduced-motion behavior;
- contrast requirements.

Automated accessibility checks should complement manual keyboard testing.

Targets and measurements come from the NFRs: WCAG 2.2 AA with 0 serious or critical automated violations on core routes (NFR-029); one keyboard-only E2E test per listed workflow, with focus trapped in dialogs and returned on close (NFR-030); live-region assertions for loading, error, stale-data and connection-status changes, and a text alternative for charts (NFR-031); an E2E test with reduced motion emulated (NFR-032). Error announcements use the localized message mapped from the error `code`, in English and Spanish (ADR-010 point 8).

---

# 37. Responsive Testing

**Status:** `Planned (FE)` (ADR-010 point 9)

Critical user flows should be tested across representative viewport sizes.

At minimum:

```text
Mobile
Tablet
Desktop
```

The goal is not to test every possible resolution.

Priority should be given to layout breakpoints where behavior changes.

The breakpoints are 900 px and 560 px (max-width), and the minimum supported width is 360 px (ADR-010 point 9). Representative widths are therefore one above 900 px, one between 561 px and 900 px, and 360 px.

---

# 38. Animation Testing

**Status:** `Planned (FE)` (NFR-032)

Animations should not be tested by exact timing unless timing itself is functional.

Instead, verify:

- element appears;
- element disappears;
- state transition occurs;
- interaction remains available;
- reduced-motion mode works.

Animation timing should remain tolerant to CI execution differences.

With `prefers-reduced-motion: reduce`, non-essential animations, including realtime update highlights, are disabled, and no information is conveyed by motion alone (NFR-032, `08-realtime-spec.md` §49).

---

# 39. Performance Testing

**Status:** client `Planned (FE)`; server realtime limits `Planned (B5)`; slow-request logging `Planned (B3)`; no performance test exists today

Performance testing should focus on known risk areas.

Priority scenarios:

- large transaction tables;
- large historical chart datasets;
- frequent realtime updates;
- dashboard rendering;
- portfolio switching;
- repeated filtering;
- background simulation;
- reconnection.

Each scenario has a measurable target in `03-non-functional-requirements.md`:

| Scenario | Target |
| --- | --- |
| Initial load, route navigation | LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms; navigation response within 100 ms (NFR-001, NFR-002) |
| Filtering, portfolio switching, dashboard interaction | INP ≤ 200 ms, no main-thread task over 200 ms (NFR-003) |
| Large historical chart datasets, large tables | §41 (NFR-008) |
| Frequent realtime updates | §40 (NFR-004 to NFR-006) |
| Background simulation, reconnection | Server limits and heartbeat (ADR-007 points 11 and 15), tested in B5 |

On the server, requests slower than 500 ms are logged at `warn` (ADR-009 point 8, NFR-017); there is no load test and metrics are `Deferred` (ADR-009 point 10).

---

# 40. Realtime Performance Tests

**Status:** client `Planned (FE)`; server limits `Planned (B5)` (NFR-004, NFR-005, NFR-006)

Realtime tests should measure whether frequent updates cause unacceptable rendering behavior.

The system should demonstrate:

- controlled update frequency;
- minimal unnecessary state changes;
- normalized realtime state;
- stable UI under sustained simulation.

The target of sub-100ms UI updates defined in the product specification should be validated under controlled test conditions.

The targets are those of the NFRs, which replace the product-specification wording:

- A price update is visible within 100 ms of the client receiving the event. This covers application propagation only, not market-data latency (NFR-004).
- One `MARKET_PRICE_UPDATED` event re-renders only the affected components (NFR-005).
- A burst of 100 events within 1 s keeps INP ≤ 200 ms and is applied in at most one render per animation frame (NFR-006).
- The steady load is one tick per second (ADR-007 point 15), driven by the injected clock so the run is repeatable.

---

# 41. Large Dataset Testing

**Status:** `Planned (FE)` (NFR-008); server pagination `Implemented` for transactions and assets (NFR-012); no larger dataset target in version 1; memory target `Deferred`

The application should have representative generated datasets.

Examples:

```text
100 transactions
1,000 transactions
10,000 transactions
100,000 market points
```

The exact benchmark sizes may be adjusted based on implementation.

The goal is to identify where:

- rendering degrades;
- memory usage grows;
- filtering slows;
- chart interaction becomes unstable.

The only measurable target is NFR-008: a chart with 5 years of daily points per asset (about 1,260 candles) keeps INP ≤ 200 ms and renders within 500 ms, measured with a browser trace on a generated dataset in demo mode. The sizes above are examples, not targets. NFR-008 is sufficient for version 1 (decided 2026-10-06, approved by the user): there is no transaction-count or larger dataset target, and a memory target stays `Deferred`. Server lists of transactions and assets are already paginated (FR-014, NFR-012), so a large transaction table is a client concern only when a list is loaded in full (§27). `MarketEvent` retention is bounded in B5 (ADR-007 point 8), so "100,000 market points" is a client-side generated series, not stored history. No dataset generator exists yet; the demo dataset is `Deferred` (ADR-010 point 6, NFR-059).

---

# 42. Simulation Load Testing

**Status:** modes `Planned (B5)` (ADR-007 points 7 and 15); configurable tick rate and stress load `Deferred`

The simulation engine should support controlled modes.

Modes (wire identifiers, ADR-007 point 15):

```text
PAUSED
NORMAL
VOLATILE
BULLISH
BEARISH
```

This allows realtime behavior to be evaluated without requiring external services.

Code vs ADR: the previous `Low`, `Normal`, `High` and `Stress` rates do not exist. ADR-007 fixes one tick per second (point 15); modes change price behavior, not the tick rate. Load is bounded by the per-connection limits (50 subscriptions, 20 inbound messages per second, 1 MB outbound buffer, 5 connections per user; ADR-007 points 15-16), which B5 tests at their thresholds. A faster tick rate or a stress mode is not decided, so it is `Deferred`. No `@trading/market-sim` package exists yet.

---

# 43. Regression Testing

**Status:** `Reference`

Every significant bug fixed in the project should result in a regression test when practical.

The test should reproduce the original failure and verify the fix.

Examples:

```text
Bug
 ↓
Regression Test
 ↓
Fix
 ↓
Permanent Protection
```

Regression tests live in the suite of the layer where the bug was found (§6-§17); there is no separate regression suite. The audits recorded in the ADRs follow this rule: for example, the frozen value series corrected in ADR-007 point 8 gets a B5 test that candles close at each UTC day rollover.

---

# 44. Test Naming

**Status:** `Reference`; followed by the existing suites

Tests should describe behavior.

Preferred:

```text
should reject a SELL when the held quantity is insufficient
```

Avoid implementation-oriented names such as:

```text
should call validateBalance()
```

unless the function itself is the intended unit under test.

The example now speaks of held quantity, not balance: the portfolio holds no cash (ADR-003). The existing `it(...)` names already describe behavior, mostly as `should ...`, with some in the present tense (`returns ...`, `rejects ...`); both forms are acceptable.

---

# 45. Test Independence

**Status:** `Implemented` across test files; shared state within a file

Tests must be independent.

A test must not rely on another test having:

- created a portfolio;
- authenticated a user;
- modified shared state;
- populated a database;
- established a WebSocket connection.

Each test should establish its own required state.

Each database and API test file creates its own users, portfolios and assets with unique emails and symbols (`crypto.randomUUID()`, `apps/api/src/test-utils/fixtures.ts`) and removes them in `afterAll`, so files never depend on each other or on seed data. Gap: within a file, most suites create the user and portfolio once in `beforeAll` and their tests share them, so a test that mutates that state can affect later tests in the same file. Where order matters, the test should create its own data; no ADR requires more.

---

# 46. Test Isolation

**Status:** database isolation by unique data `Implemented`; in-memory stores `Planned (B0)`; browser contexts `Planned (FE)`; deterministic seeds `Planned (B5)`

Tests should use isolated state.

Possible mechanisms:

- reset mock stores;
- database transactions;
- test database cleanup;
- deterministic seeds;
- isolated browser contexts.

The chosen mechanism depends on the test layer.

| Layer | Mechanism | Status |
| --- | --- | --- |
| Domain unit tests | Pure functions, no shared state | `Implemented` |
| Database and API tests | One shared test database (`.env.test.local`); unique rows per file, deleted in `afterAll`. No per-test transaction rollback and no truncation between runs | `Implemented` |
| Application services | Fresh in-memory fakes per test (ADR-001 point 7) | `Planned (B0)` |
| Simulator | Fixed seed and injected clock (ADR-007 point 7) | `Planned (B5)` |
| Component and E2E | Isolated browser contexts; tool `Deferred` to the frontend-stage ADR (ADR-006 point 11) | `Planned (FE)` |

`packages/database/src/seed/wipe.ts` deletes every table; it is a seed step, never used by tests.

---

# 47. Flaky Test Policy

**Status:** `Reference`

Flaky tests must not be ignored.

If a test fails intermittently:

1. identify the source;
2. reproduce the failure;
3. fix the underlying synchronization or isolation issue;
4. avoid arbitrary retries as a permanent solution.

Retries may be used temporarily for diagnostics but should not hide real instability.

No Vitest config sets `retry`, and no test is skipped (`.skip`) or focused (`.only`). Rate-limit tests use an isolated limiter instead of timing the real one (§29).

---

# 48. Mocking Policy

**Status:** `Reference`; fakes for repositories `Planned (B0)`; realtime transport double `Planned (FE)`

Mocks should be used at architectural boundaries.

Good candidates:

- external APIs;
- realtime transports;
- repositories;
- browser APIs;
- time;
- randomness.

Avoid mocking the unit under test itself.

The goal is to test behavior, not mock interactions.

Today no test uses `vi.mock`, fake timers or a mocked repository: domain tests need no doubles, and database and API tests use real PostgreSQL. ADR-001 point 7 prefers in-memory fakes that implement the repository contracts over interaction mocks, so the same fakes later serve the demo (§18). There is no external API to mock: all market data is synthetic (ADR-007 point 8). The realtime client is tested through a transport test double (`08-realtime-spec.md` §42-43).

---

# 49. Time Control

**Status:** shared `Clock` port `Planned (B0)` (ADR-001 point 8); simulator clock on that port `Planned (B5)` (ADR-007 point 7); no controllable clock exists today

Time-dependent functionality should use controllable clocks where practical.

This is important for:

- token expiration;
- alerts;
- simulations;
- time ranges;
- background jobs;
- retries;
- timeouts.

Tests must not rely on arbitrary real-world delays.

ADR-001 point 8 decides one shared `Clock` port, injected through the composition root in B0; the simulator clock of ADR-007 point 7, which also drives alerts and candle rollover in B5, uses the same port. Today the code reads the system clock directly: `validateNewTransaction` rejects a future `executedAt` against `new Date()` (`packages/domain/src/entities/transaction.ts`), the API services stamp `readAt` and end the overview's candle range at `new Date()`, and the mappers default timestamps the same way. No test uses fake timers, and none waits on real time. Token expiration (B2), job timeouts (B4) and time ranges (B1) need a controllable clock to be tested without delays. In B0 these call sites move to the `Clock` port: domain code such as `validateNewTransaction` receives the current time instead of calling `new Date()`, and tests supply a fixed clock.

---

# 50. Randomness Control

**Status:** `Planned (B5)` (ADR-007 point 7, NFR-059); demo determinism `Planned (FE)` (NFR-045)

Random simulation behavior must support deterministic seeds.

This allows:

- reproducible bugs;
- stable tests;
- predictable demo scenarios;
- interview demonstrations.

Randomness should be isolated behind an explicit abstraction.

The abstraction is the seeded pseudo-random generator inside `@trading/market-sim` (ADR-007 point 7): the same seed and clock produce the same price series, asserted by a B5 test (NFR-059). The demo test runs initialization twice with one seed and compares the state (NFR-045). Domain calculations use no randomness (NFR-042). Today no production code calls `Math.random`; test fixtures use `crypto.randomUUID()` only to make rows unique, never to drive behavior.

---

# 51. Network Failure Testing

**Status:** realtime failures `Planned (FE)`; demo simulated latency and scripted failures `Deferred` (ADR-010 point 6)

The demo and automated tests should simulate:

- offline state;
- latency;
- timeout;
- server error;
- connection reset;
- malformed response.

The application must provide recovery behavior where appropriate.

Decided recovery behavior to test: a dropped socket triggers reconnection with backoff, HTTP polling every 10 s and a stale-data indicator (§23, ADR-007 point 12); a malformed realtime event is dropped (§21); the server answers a 500 or a 503 `DEPENDENCY_ERROR` with the error envelope `{ error: { code, message, requestId, details? } }` (ADR-002 points 2 and 10), and the UI shows the error state with a retry (§13). Offline state, latency and timeouts in the demo are demo specifics, decided in the frontend-stage ADR (ADR-010 point 6). The HTTP client's timeout and retry policy is `Deferred` to the frontend-stage ADR, consistent with ADR-002 point 10 (no server timeout) (ADR-006 point 11).

---

# 52. API Contract Testing

**Status:** `Planned (B0)` (ADR-002 point 6); OpenAPI generation `Planned (B6)` (ADR-002 point 7)

API request and response contracts should be verified against the `@trading/contracts` Zod schemas.

Contract tests should detect:

- renamed fields;
- missing fields;
- incompatible types;
- incorrect status codes;
- malformed error responses.

This reduces frontend/backend integration regressions.

Code vs ADR: the previous text verified contracts against an OpenAPI document. ADR-002 makes the Zod schemas the single source: the API integration tests validate every response against its schema (point 6), and OpenAPI is generated from the same schemas in B6 (point 7), so a separate OpenAPI check would test the generator, not the API. The demo adapter validates responses during development (point 6). Error responses are checked against the error envelope schema (points 2 and 10). Contract tests are one of the named mandatory tests that replace a coverage threshold (ADR-006 point 11). No `packages/contracts` exists yet; today the route tests assert shape by hand (§16).

---

# 53. CI Test Pipeline

**Status:** backend stages `Planned (B0)` (ADR-006 points 10-11); component, E2E and accessibility stages `Deferred` to the frontend-stage ADR; no CI workflow exists today

The CI pipeline should follow:

```text
Install
  ↓
Typecheck
  ↓
Lint
  ↓
Unit Tests
  ↓
Component Tests
  ↓
Integration Tests
  ↓
Build
  ↓
E2E Tests
  ↓
Accessibility Checks
```

Performance tests may run separately when they are too expensive for every pull request.

The decided workflow is one GitHub Actions workflow on pushes and pull requests to `develop` and `main`, with no continuous deployment (ADR-006 points 10-11):

| Stage | Command | Status |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | `Planned (B0)` |
| Typecheck | `pnpm typecheck` | `Planned (B0)` |
| Lint | `pnpm lint` | `Planned (B0)` |
| Formatting | `pnpm format:check` | `Planned (B0)` (point 11) |
| Build | `pnpm build` | `Planned (B0)` (point 11) |
| Unit and integration tests | `pnpm test` (domain, database and API suites; the latter two against a PostgreSQL service container, migrated before the run) | `Planned (B0)` |
| Component, E2E, accessibility | tools chosen in the frontend-stage ADR; join when frontend code exists | `Deferred` |
| Performance | browser traces of §39-§41 | `Deferred` |

`pnpm build` passes today (`pnpm -r build`, `tsc --build`). The stage order inside the workflow is not fixed by the ADR, apart from install first. Component, E2E and accessibility checks join this workflow once frontend code exists, as the frontend-stage ADR decides (ADR-006 point 11); until then they stay `Deferred`. There is no coverage stage (§55).

---

# 54. Pull Request Quality Gate

**Status:** local checks and PR template `Implemented`; automated gate `Planned (B0)` (ADR-006 points 10-11); E2E gate `Deferred`

A pull request should not be considered complete when:

- type checking fails;
- lint fails;
- required tests fail;
- build fails;
- critical E2E flows fail.

Tests should be treated as part of implementation rather than a final manual step.

Today nothing blocks a merge automatically. The pre-commit hook only formats and lints staged files (§5), and the checklist in `.github/PULL_REQUEST_TEMPLATE.md` asks for `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm test` and `pnpm docs:check`, as self-reported checkboxes that nothing enforces. From B0 the CI workflow of §53 is the gate: type checking, lint, formatting, build and the backend test suites must pass. "Critical E2E flows fail" applies once E2E tests exist (`Planned (FE)`); no coverage percentage is part of the gate (§55).

---

# 55. Coverage Strategy

**Status:** `Reference`; coverage threshold `Deferred` (ADR-006 point 11)

Coverage should be used as a diagnostic metric rather than a target to game.

High coverage is expected for:

- domain rules;
- calculations;
- authorization;
- validation;
- critical application services.

Lower coverage may be acceptable for:

- simple UI composition;
- generated code;
- trivial configuration;
- purely visual details.

Critical behavior matters more than a global percentage.

Version 1 sets no coverage threshold and CI has no coverage gate (ADR-006 point 11); no coverage provider is configured. "High coverage" for the areas above is met by named mandatory tests, not a percentage:

| Area | Mandatory tests | Status |
| --- | --- | --- |
| Domain rules, calculations | Domain unit tests (§7) | `Implemented` |
| Critical application services | Use-case tests with in-memory fakes (ADR-001 point 7) | `Planned (B0)` |
| Validation, response shape | Contract tests against `@trading/contracts` (ADR-002 point 6, §52) | `Planned (B0)` |
| Authorization | Cross-user 404 tests and permission tests by role (§30) | ownership `Implemented`; roles `Planned (B2)` |

---

# 56. Test Environments

**Status:** development and test `Implemented`; local production-like stack `Planned (B7)`; demo `Planned (FE)` (ADR-006 points 1 and 8)

The project should distinguish:

```text
Development
Test
Demo
Production-like
```

### Development

Used for daily implementation.

### Test

Controlled environment for automated tests.

### Demo

Public-facing mock-powered experience.

### Production-like

Local environment using the complete backend architecture.

ADR-006 point 8 names three environments, `development`, `test` and local `production`, plus the demo as a separate target (point 1):

| Environment | What it is | Status |
| --- | --- | --- |
| Development | Local API against the default Docker Compose profile (PostgreSQL only) | `Implemented` |
| Test | Local PostgreSQL test database from `.env.test.local` (`.env.test.example`); in CI, a PostgreSQL service container | `Implemented` locally; CI `Planned (B0)` |
| Demo | Static build of `apps/web` with `APP_MODE=demo` (`VITE_APP_MODE`), no backend calls, served under a subpath (ADR-006 point 7) | `Planned (FE)` |
| Production-like | Compose `full` profile (PostgreSQL and the built API, `node dist/index.js`) on the author's machine | `Planned (B7)` |

There is no hosted or optional deployment environment: hosting the backend needs a new ADR (ADR-006 point 2).

---

# 57. Demo vs Production Testing

**Status:** shared repository contract suite `Planned (B0)` (ADR-001); demo wiring `Planned (FE)`

The same application behavior should be exercised against both:

```text
Mock Infrastructure
```

and:

```text
Real Infrastructure
```

where practical.

The purpose is to demonstrate that infrastructure is replaceable without rewriting product behavior.

"Where practical" becomes three concrete mechanisms: one repository contract suite runs against both the Prisma and the in-memory implementations (§18, NFR-044); the same use cases from `@trading/application` run in the API and in the browser (ADR-001); and both sides validate against the same `@trading/contracts` schemas (ADR-002 point 6, NFR-057). The realtime client port has an in-process demo adapter fed by the same `@trading/market-sim` engine (ADR-007 point 13). Today only the Prisma side exists.

---

# 58. Testability Requirements

**Status:** partial `Implemented` (isolated domain logic, repository contracts); the rest by block, listed below

The architecture must make important behavior easy to test.

Required properties:

- dependency injection at infrastructure boundaries;
- deterministic simulation;
- isolated domain logic;
- explicit state transitions;
- typed contracts;
- replaceable repositories;
- controllable clocks;
- controllable randomness;
- transport abstractions.

| Property | Today | Decision and status |
| --- | --- | --- |
| Dependency injection at infrastructure boundaries | API services create Prisma repositories at module level (for example `new PrismaPortfolioRepository()`) | Factories receive dependencies; composition root in `apps/api/src/composition.ts` (ADR-001 points 2 and 4), `Planned (B0)` |
| Deterministic simulation | No simulator | `@trading/market-sim`, `Planned (B5)` (ADR-007 point 7) |
| Isolated domain logic | Pure calculations, no database (NFR-042) | `Implemented`; gap: `validateNewTransaction` reads the system clock, moved to the `Clock` port in B0 (§49) |
| Explicit state transitions | None | Jobs `Planned (B4)` (ADR-008 point 3); simulator lifecycle `RUNNING <-> HALTED` `Planned (B5)` (ADR-007 point 16); realtime client states `Planned (FE)` |
| Typed contracts | Hand-written DTOs | `@trading/contracts`, `Planned (B0)` (ADR-002) |
| Replaceable repositories | Repository interfaces in `@trading/domain` with Prisma implementations | Interfaces `Implemented`; in-memory implementations `Planned (B0)` (NFR-044) |
| Controllable clocks | None | Shared `Clock` port `Planned (B0)` (ADR-001 point 8); simulator on that port `Planned (B5)` (§49) |
| Controllable randomness | None needed yet | Seeded generator `Planned (B5)` (§50) |
| Transport abstractions | None in the client | Realtime client port with a demo adapter, `Planned (FE)` (ADR-007 point 13); HTTP through a DTO client (ADR-002 point 5) |

---

# 59. Required Test Matrix

**Status:** `Reference`; per-column status below the table

| Area | Unit | Component | Integration | E2E |
|---|---:|---:|---:|---:|
| Domain calculations | Required | — | — | — |
| Validation | Required | Required | Required | — |
| Forms | — | Required | Required | Required |
| Authentication | Required | Required | Required | Required |
| Authorization | Required | — | Required | Required |
| Portfolios | Required | Required | Required | Required |
| Transactions | Required | Required | Required | Required |
| Analytics | Required | Required | Required | Required |
| Tables | — | Required | — | Required |
| Charts | Required | Required | — | Required |
| Realtime | Required | Required | Required | Required |
| Background jobs | Required | Required | Required | Required |
| Notifications | Required | Required | Required | Required |
| Simulation | Required | Required | Required | Required |
| Security | Required | — | Required | Required |
| Accessibility | — | Required | — | Required |
| Performance | Required | Required | Required | Selected |

How the columns map to the code and blocks:

- **Unit.** Domain calculations, validation and entity rules are `Implemented` (§7-§9). Application-service unit tests (authorization, portfolios, transactions, notifications) are `Planned (B0)` (ADR-001 point 7); analytics `Planned (B1)`; background jobs `Planned (B4)`; realtime and simulation `Planned (B5)`.
- **Component** and **E2E.** `Planned (FE)` for every row; tools `Deferred` to the frontend-stage ADR (ADR-006 point 11).
- **Integration.** Authentication, authorization, portfolios, transactions and notifications are `Implemented` (§16, §26, §29-§30). `analytics.routes.ts`, `positions.routes.ts`, `assets.routes.ts` and `market.routes.ts` have no route test file yet (the overview is exercised once, in `transactions.routes.test.ts`). Their HTTP integration tests are `Planned (B0)`, added before the layering refactor as its safety net (ADR-001 point 8); the reworked analytics endpoints are then tested in B1 (ADR-004). Background jobs `Planned (B4)`; realtime and simulation `Planned (B5)`.
- **Background jobs** means the CSV import (ADR-008), whose E2E flow is in §33. **Tables** follow ADR-010 points 4 and 9 (§27). **Performance** targets are those of §39-§41; no server load test is planned.

---

# 60. Minimum Automated Test Suite

**Status:** unit and integration partial `Implemented`; component and E2E `Planned (FE)`

Before the project is considered portfolio-ready, the following must exist:

### Unit

- core domain calculations;
- transaction rules;
- validation;
- permissions;
- simulation;
- realtime event processing.

### Component

- major forms;
- major tables;
- dashboard states;
- dialogs;
- notifications;
- realtime indicators.

### Integration

- authentication;
- authorization;
- portfolio API;
- transaction API;
- analytics API;
- realtime events;
- repository behavior.

### E2E

- login/demo entry;
- portfolio workflow;
- transaction workflow;
- analytics workflow;
- realtime workflow;
- CSV import workflow;
- error/retry workflow;
- logout/reset.

| Group | Exists today | Still to build |
| --- | --- | --- |
| Unit | Domain calculations, `Money`, transaction input rules (`transaction.test.ts`), position rules, request validation middleware (`validate.test.ts`) | Chronological validation and application services `Planned (B0)`; permissions `Planned (B2)`; simulation and realtime event processing `Planned (B5)` |
| Component | Nothing | All items `Planned (FE)` |
| Integration | Authentication, authorization by ownership, portfolio API, transaction API, repository behavior | Contract tests and route tests for analytics, positions, assets and market `Planned (B0)` (ADR-001 point 8); reworked analytics API `Planned (B1)`; import API `Planned (B4)`; realtime events `Planned (B5)` |
| E2E | Nothing | All items `Planned (FE)`; CSV import added on 2026-10-06 (§33); reset `Deferred` (ADR-010 point 6), so "logout/reset" means logout |

---

# 61. Definition of Done — Feature

**Status:** `Reference`; automated part enforced by CI from B0 (ADR-006 points 10-11)

A feature is considered complete when:

- implementation is complete;
- TypeScript passes;
- lint passes;
- formatting passes;
- relevant unit tests exist;
- relevant component tests exist;
- integration tests exist when boundaries are involved;
- E2E coverage exists when the feature is part of a critical user journey;
- loading state is handled;
- empty state is handled;
- error state is handled;
- accessibility has been considered;
- responsive behavior has been verified;
- demo mode supports the feature;
- documentation is updated when architectural behavior changes.

TypeScript, lint, formatting, build and the backend test suites become CI checks in B0 (§53); until then they are run by hand. The mandatory tests that a feature in its block names (ADR-001 point 7, ADR-002 point 6) replace any coverage percentage (ADR-006 point 11). Items about components, UI states, responsiveness and demo support apply to features with a UI, built in the frontend stage; the demo items stay subject to the frontend-stage ADR (ADR-010 point 6). Every user-facing string exists in English and Spanish (ADR-010 point 8).

---

# 62. Definition of Done — Demo

**Status:** `Planned (FE)`; reset `Deferred` (ADR-010 point 6)

The public demo is considered complete when a visitor can experience the platform without backend dependencies.

The demo must support:

```text
Entry
 ↓
Authentication Simulation
 ↓
Dashboard
 ↓
Portfolio Management
 ↓
Transactions
 ↓
Analytics
 ↓
Realtime Simulation
 ↓
Alerts / Notifications
 ↓
Background Processes
 ↓
Errors
 ↓
Recovery
 ↓
Logout / Reset
```

No screen should exist only as a visual mock.

Mapping to the decisions: the demo is a static build with no backend calls and no secrets (ADR-006 point 7), running the same use cases in the browser on in-memory repositories (ADR-001). "Authentication simulation" is the controlled demo identity with the `Viewer`, `Trader` and `Admin` selector (ADR-005 point 11). "Background processes" is the CSV import with simulated progress and injectable failures (ADR-008 point 13). "Realtime simulation" is `@trading/market-sim` behind the in-process realtime adapter (ADR-007 point 13). "Logout / Reset": logout is decided; reset is `Deferred` with the other demo specifics (ADR-010 point 6). Today no `apps/web` code exists.

---

# 63. Failure Scenarios Required in Demo

**Status:** import job failures and simulation pause `Planned (FE)`; scripted failures `Deferred` (ADR-010 point 6)

The demo should intentionally support selected reproducible failures.

Examples:

```text
Network Timeout
API 500
Unauthorized
Forbidden
Validation Error
Realtime Disconnect
Realtime Reconnect
Background Job Failure
Background Job Timeout
Empty Dataset
Simulation Pause
```

These scenarios should be controllable without making the normal user flow frustrating.

| Scenario | Decision | Status |
| --- | --- | --- |
| Background Job Failure, Background Job Timeout | Injectable failures in the in-process CSV import (ADR-008 point 13; states `FAILED` and `TIMED_OUT`, point 3) | `Planned (FE)` |
| Simulation Pause | Mode `PAUSED` (ADR-007 point 15); in real mode the lifecycle state is `HALTED` (point 16) | `Planned (FE)` |
| Empty Dataset | Empty states of §15 | `Planned (FE)` |
| Forbidden | The `Viewer` role is refused mutations through the same permission checks (ADR-005 points 3 and 11) | `Planned (FE)` |
| Validation Error | Real validation from the shared use cases, for example a `SELL` above the held quantity (ADR-003 point 6) | `Planned (FE)` |
| Network Timeout, API 500, Unauthorized, Realtime Disconnect, Realtime Reconnect | Scripted failures and simulated latency are demo specifics | `Deferred` (ADR-010 point 6) |

The demo has no network (ADR-006 point 7), so network and HTTP failures can only be scripted; they wait for the frontend-stage ADR.

---

# 64. Interview Demonstration Mode

**Status:** realtime scenario `Planned (B5)` (server) and `Planned (FE)` (client); failure scenario `Deferred` (ADR-010 point 6); architecture scenario `Planned (FE)` as two builds

The application should provide deterministic scenarios suitable for technical interviews.

Examples:

### Realtime Scenario

```text
Start Simulation
 ↓
Price Updates
 ↓
Portfolio Value Changes
 ↓
Alert Triggered
```

### Failure Scenario

```text
Start Operation
 ↓
Simulated Failure
 ↓
Error State
 ↓
Retry
 ↓
Successful Recovery
```

### Architecture Scenario

```text
Switch:
Mock Repository
        ↓
Real API
```

where technically feasible.

The objective is to make architectural decisions observable rather than merely documented.

Notes against the ADRs:

- **Realtime scenario.** Deterministic scenarios are the simulator's (ADR-007 point 7), with wire identifiers `STABLE_MARKET`, `BULLISH_SESSION`, `VOLATILE_SESSION`, `SHARP_DRAWDOWN` and `RECOVERY` (point 15). Starting the simulation requires `simulation:control`, held only by `ADMIN` (ADR-005 point 13). The client recomputes the portfolio value from prices (ADR-007 point 6); the alert fires once per false-to-true edge (point 9).
- **Failure scenario.** Needs scripted failures, `Deferred` (ADR-010 point 6). The CSV import with an injected failure and a retry (ADR-008 points 6 and 13) is the decided failure-and-recovery path.
- **Architecture scenario.** There is no runtime switch: `APP_MODE` is fixed at build time through `VITE_APP_MODE` (ADR-006 point 8), and the public demo calls no backend (point 7). The scenario is shown by running the demo build and the local full stack side by side on the same use cases (§57).

---

# 65. Testing Acceptance Criteria

**Status:** `Reference`; per-criterion status below

Testing is considered complete when:

- core business rules have unit tests;
- critical components have interaction tests;
- API boundaries have integration tests;
- authentication and authorization are tested;
- realtime behavior is tested;
- simulation is deterministic;
- critical E2E flows pass;
- demo flows are covered;
- failure and recovery states are covered;
- accessibility has automated and manual verification;
- representative performance scenarios are validated;
- CI executes the required quality gates;
- tests are reproducible and isolated.

| Criterion | Status |
| --- | --- |
| Core business rules have unit tests | `Implemented` for the domain; application services `Planned (B0)` |
| Critical components have interaction tests | `Planned (FE)` |
| API boundaries have integration tests | `Implemented` for most routes (gaps in §59); contract tests `Planned (B0)` |
| Authentication and authorization are tested | partial `Implemented` (§29-§30); sessions and roles `Planned (B2)` |
| Realtime behavior is tested | `Planned (B5)` and `Planned (FE)` |
| Simulation is deterministic | `Planned (B5)` (ADR-007 point 7) |
| Critical E2E flows pass | `Planned (FE)` (§33) |
| Demo flows are covered | `Planned (FE)`; reset and scripted failures `Deferred` (§34) |
| Failure and recovery states are covered | Server error responses `Implemented` (§13); UI and demo `Planned (FE)` |
| Accessibility has automated and manual verification | `Planned (FE)` (§36) |
| Representative performance scenarios are validated | `Planned (FE)` (§39-§41) |
| CI executes the required quality gates | `Planned (B0)` (ADR-006 points 10-11); no coverage gate |
| Tests are reproducible and isolated | `Implemented` across files (§45-§46); shared `Clock` port `Planned (B0)` (§49) |

---

# 66. Testing Philosophy Summary

**Status:** `Reference`

The testing strategy follows one principle:

> **Test the behavior that makes the product trustworthy, not merely the code that makes it executable.**

The public demo and the production-oriented implementation must share the same application behavior and contracts wherever possible.

Mock infrastructure changes **where data comes from**, not **how the product behaves**.
