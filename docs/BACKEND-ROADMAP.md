# Backend Completion Roadmap

> **Reconciled with the ADRs (2026-10-08).** This file agrees with the
> architecture decision records in `docs/adr/` (ADR-001 to ADR-010) and with
> `15-implementation-plan.md` §4.1 to §4.3 and §63. Where it and an ADR
> disagree, the ADR wins. Each block lists what the ADRs settled and the
> deferred details they assign to it; nothing here decides a question the
> ADRs leave open.

**Purpose:** the ordered path to finish the whole backend before starting
the frontend and the public demo. This is a working plan, not a
specification: the SDD (`00`-`16`) stays the source of truth for behavior,
`PROGRESS.md` records what is done and why, and this file says what is
left, in what order, and when each block counts as closed.

**Last updated:** 2026-10-08 (reconciled with ADR-001 to ADR-010)
**Status:** B0 is in progress (B0.1 done: minimal CI, `.nvmrc`, version
alignment, `check-docs` hardening). B0 comes first, then B1 to B7.
**Decision behind it:** the user chose to finish the backend completely
before starting the frontend. This is a deliberate override of the phase
order in `15-implementation-plan.md` §4, which alternated backend and
frontend work; `15` §4.1 (Backend-First Override) records the decided
order, ADR-006 point 1 and `00-overview.md` §1 fix it.
**Evidence base:** `PROGRESS.md`, the SDD, the ADRs, and a direct check of
the code on 2026-10-03, re-verified on 2026-10-08: `apps/api` route and
service tree, `apps/api/src/index.ts`, `config/env.ts`, `auth.service.ts`,
`apps/api/package.json`, `packages/*`, `schema.prisma`, `.github/`.
Items marked *(unverified)* were not checked in code.

---

## 1. Where the backend stands

Done and covered by tests (details in `PROGRESS.md`): auth login and `me`,
portfolios, positions, transactions (synchronous, atomic through
`UnitOfWork`), assets, market prices and history, allocation and
attribution, overview (with `dailyChange` and `pulse`), watchlist, alerts,
notifications, preferences, decisions (read and replay), scenarios (full,
with calculate and compare). Cross-cutting: request IDs, a normalized
error contract, validation, rate limiting, helmet and CORS, health and
readiness, two separate databases (dev and test).

Routes without a route test file today: analytics, positions, assets,
market, overview, and the health routes (`GET /health`,
`GET /health/ready`). B0 adds all of them except the overview (ADR-001
point 8); the overview test is folded into B1.

Checked on 2026-10-03 and re-verified on 2026-10-08, **absent** (except the two
rows marked `Implemented` by B0.1):

| Area | Evidence |
|---|---|
| Minimal CI | `Implemented` (B0.1): `.github/workflows/ci.yml` runs the verify job on pushes and pull requests; the CI test roles of ADR-005 point 13 stay `Planned (B0)` (ADR-006 points 10-11) |
| Application layer and contracts | no `packages/application`; `packages/contracts` and `packages/config` hold only `.gitkeep` (ADR-001, ADR-002, B0); services in `apps/api/src/services` import `@trading/database` directly |
| `Clock` port | `validateNewTransaction` calls `new Date()` (`packages/domain/src/entities/transaction.ts`) |
| Runtime version pin | `Implemented` (B0.1): `.nvmrc` pins Node 24 (LTS) and `engines.node` is `>=24.0.0` (ADR-006 point 13) |
| Configuration safety | `CORS_ORIGIN` is split on commas with no origin check (`config/env.ts`); the seed has no `NODE_ENV=production` guard (ADR-006 point 13, B0) |
| Login timing equalization | `auth.service.ts` returns before `bcrypt.compare` when the user or credential is missing (ADR-005 point 13, B0) |
| Route-parameter validation | `validate` accepts only `body` and `query` (ADR-002 point 10, B0) |
| Logout and refresh endpoints | `auth.routes.ts` only has `login` and `me` |
| Performance, risk and pulse endpoints | `analytics.routes.ts` only has `allocation` and `attribution` |
| Role enforcement | no `requireRole`; `authenticate` only; `UserRole` is `USER` and `ADMIN` |
| Logger | no logger module; `index.ts` uses `console.log`; no logging dependency in `package.json` |
| Metrics | none, and none planned: `Deferred` (ADR-009 point 10) |
| Graceful shutdown | `index.ts` is `createApp()` plus `listen()` |
| WebSocket / realtime | no server, no dependency |
| Background jobs and idempotency keys | no table in `schema.prisma`, no routes |
| OpenAPI | no generator or document |
| Production build | `PROGRESS.md` §7: `@trading/domain` and `@trading/database` point `main` at `src` |
| API Dockerfile and `full` Compose profile | `docker/` holds only `.gitkeep`; `docker-compose.yml` has PostgreSQL only |

---

## 2. Definition of "backend done"

All of the following, then the frontend can start (`15` §4.1):

1. B0 is closed first, then blocks B1 to B7 below are closed against their
   own "Done when".
2. The verification loop passes: `pnpm typecheck`, `pnpm lint`,
   `pnpm format:check`, `pnpm docs:check`, `pnpm build`, and the domain,
   database and api test suites. From B0 the minimal CI runs this loop on
   every push and pull request.
3. Every deliberate divergence from the SDD is reflected in the SDD.
4. `PROGRESS.md` is current.
5. The handoff artifacts for the demo exist (section 6).

---

## 3. The blocks, in order

Order reasoning: the minimal CI and B0 come first because the application
layer (ADR-001) and the shared contracts (ADR-002) are what every later
block, and the demo, build on; moving the services afterwards would mean
rewriting each block's work. B1 is a P0 requirement and depends only on B0.
B2 is small and closes security before more surface is added. B3 comes
before Realtime and Jobs because those are the hardest to debug blind (the
plan puts observability at Phase 13; it is pulled forward on purpose). B4
before B5 because job progress is a realtime event. B6 documents the final
surface. B7 prepares deployment.

Each block follows the usual method: read the real code and the specs
first, propose small slices, wait for approval, apply, verify, commit.

### B0. Application layer, shared contracts and minimal CI

**Why first:** ADR-001 and ADR-002 move the use cases and the wire format
into packages that both the API and the demo consume, ADR-006 puts a
minimal CI in front of all backend work, and `15` §4.2 assigns the route
tests, the `Clock` port and the contract suite to this block. The
ESLint import-boundary rule and the move of the services are a refactor of
existing behavior, so the tests that prove it unchanged come first.

**Scope**

*Minimal CI and configuration safety (ADR-006 points 10, 11 and 13)*
- One GitHub Actions workflow on pushes and pull requests to `develop` and
  `main`: install with the lockfile, `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, `pnpm docs:check`, `pnpm test` (the database and API
  suites run against a PostgreSQL service container) and `pnpm build`. No
  continuous deployment and no coverage threshold.
- Test variables come from the job `env`, not from a generated
  `.env.test.local`. The CI test database uses the runtime and migration
  roles of ADR-005 point 13.
- `.nvmrc` as the single Node.js version source, reused by CI and later by
  the Dockerfile. The exact major is chosen here after confirming it is an
  LTS release; `engines.node` and `@types/node` are aligned to it, together
  with the `typescript` version across packages (`15` §5).
- Seed production guard: the seed and the hard database reset refuse to run
  when `NODE_ENV=production`.
- `CORS_ORIGIN` validation: only `http(s)://host[:port]` origins, and `*` is
  rejected.
- Hardening `scripts/check-docs.mjs` (task T1.5: one shared fence-state
  helper and fixture-based tests) is not decided in an ADR and stays open
  for this block (`15` §5).

*Application layer (ADR-001)*
- `packages/application` (`@trading/application`), depending only on
  `@trading/domain`, with one factory per resource that receives its
  dependencies. The boundary is enforced by an ESLint import-boundary rule
  (the config holds only a commented placeholder today).
- Transport-free application errors (`NotFoundError`, `ConflictError` and
  similar), mapped by the API error handler to HTTP status codes.
- The `Actor { userId, role }` type and the permission-check mechanism
  (ADR-005 point 3), so B2 only fills in the roles and the matrix.
- The composition root `apps/api/src/composition.ts`, which builds the
  Prisma repositories and `PrismaUnitOfWork` and injects them. Routes and
  controllers receive the composed services.
- Composite reads (overview, scenario calculate and compare, decision
  replay, analytics) move into the application layer.
- In-memory implementations of the repository contracts and of
  `UnitOfWork`, with rollback.
- The archived-portfolio guard (ADR-010 point 5): any mutation scoped to an
  archived portfolio returns 409 `CONFLICT` and writes nothing.

*Shared contracts (ADR-002)*
- `packages/contracts` (`@trading/contracts`): request schemas moved from
  `apps/api/src/schemas/`, response schemas for every endpoint, the error
  envelope, the pagination `meta`, presenters and the DTO types. Controllers
  never serialize a domain object directly.
- Error contract changes: `{ field, code, message }` validation details,
  `TIMEOUT` removed from `AppErrorCode`, and 503 `DEPENDENCY_ERROR` when the
  database is unreachable.
- Route parameters validated with a Zod schema like body and query: a
  malformed value is 400 `VALIDATION_ERROR`, a well-formed unknown or
  foreign ID is still 404.
- `UserPreference.theme` accepts `light`, `dark` or `system`, and
  `UserPreference.language` accepts `en` or `es` (ADR-002 point 10,
  ADR-010 point 8); other values are 400.
- Persisted JSON money as decimal strings (ADR-002 point 9):
  `decision-replay.ts` and `scenario-impact.ts` stop using floating point.

*Transactions (ADR-003 point 6, ADR-001 Deferred detail)*
- Chronological validation (FR-018): a transaction is accepted only if the
  holding stays non-negative at its `executedAt` and after every later
  transaction in date order. Backdating is allowed.
- The position projection is rebuilt by replaying the asset's transactions
  in date order, so a backdated transaction gives the right
  `averageEntryPrice` and `openedAt` (`15` §12).
- The position-recalculation race (FR-017) is fixed here, not in B7: the
  `UnitOfWork` contract guarantees isolation for position updates.

*Tests (ADR-001 points 7 and 8, ADR-002 point 6)*
- One shared `Clock` port injected through the composition root; domain and
  application code receive the time instead of calling `new Date()`, and
  tests supply a fixed clock.
- Route tests for analytics, positions, assets and market, which have no
  route test file today, written before the services move.
- Route tests for `GET /health` and `GET /health/ready` (NFR-051 is
  `Implemented` in `apps/api/src/routes/health.ts` with no test).
- Application services tested with in-memory fakes of the repository
  contracts.
- One repository contract suite that runs against the Prisma and the
  in-memory implementations, extracted from the existing Prisma repository
  tests.
- Contract tests of the API responses against the `@trading/contracts`
  schemas.

*Security details assigned to this block (ADR-005 point 13)*
- A separate runtime database role without DDL rights; only the migration
  role keeps them.
- Login timing equalization: when the user does not exist, login still runs
  a `bcryptjs` check against a fixed dummy hash. The generic message is
  unchanged.

*Recorded here, built in B7 (ADR-006 point 4)*
- The API Dockerfile lives at `apps/api/Dockerfile` and is built with the
  workspace root as the build context.
- The container entrypoint is `node dist/index.js` with no shell or
  package-manager wrapper, so `SIGTERM` reaches the process. The shutdown
  handler itself is B3.

**Settled by the ADRs:** package names and locations (ADR-001 point 1,
ADR-002 point 1); function-per-resource factories, not use-case classes;
decimal-string money on the wire and in persisted JSON; no runtime response
validation in production; no server request timeout in version 1.

**Deferred detail assigned to B0**

| Item | Source |
|---|---|
| Two concurrent `SELL` of 6 on a holding of 10: exactly one succeeds (row lock, advisory lock, or `SERIALIZABLE` with retry; a concurrent test covers it) | ADR-001 |
| The in-memory `UnitOfWork` serializes units with an async mutex, or rolls back only its own write log, so interleaved units cannot erase each other's writes | ADR-001 |
| Decimal strings come out in fixed notation, never `"5e-8"`; the response schema enforces the pattern and scale and rounding of computed amounts are defined | ADR-002 |
| `decision-replay.ts` parses `price` and `quantity` with `Decimal`, accepts only decimal strings, and reports other values as issues; seed data and fixtures are rewritten to strings | ADR-002 |
| `scenario-impact.ts` builds the price factor as `Decimal(percentChange).div(100).plus(1)`; a test asserts an exact result for `-12.3` | ADR-002 |
| Transactions with the same `executedAt` are ordered by `executedAt`, then creation order (row order for an import), with a test for a `BUY` and a `SELL` sharing a timestamp | ADR-003 |
| Rate limits stay on in development; restarting the API clears the counters | ADR-006 |
| `dateFrom` and `dateTo` on the decisions list filter on `createdAt`; the contracts query schema states it and a test covers it (decided 2026-10-08) | `PROGRESS.md` §7 |
| `Scenario.baseSnapshotId` stays a nullable string with no behavior in the contracts, because snapshots are `Deferred` (decided 2026-10-08) | `05-data-model.md` §14 |
| Reword the two code comments that still describe asynchronous transaction creation as deferred (`apps/api/src/services/transaction.service.ts`, `apps/api/src/controllers/transactions.controller.ts`): creation is synchronous by design | ADR-008 point 12 (T6.2 review) |

**Done when:** the CI workflow is green on a clean checkout; the new route
tests pass before and after the layering refactor with HTTP behavior
unchanged; `@trading/application` imports no Prisma, Express, Zod transport
schema or browser API (the lint rule fails otherwise); the repository
contract suite passes against both implementations; the chronological,
concurrent-`SELL`, archived-portfolio, route-parameter and login-timing
tests exist; `07-api-spec.md` and `05-data-model.md` agree with the
contracts package.

**Size:** large. Plan it as several slices: CI and configuration safety,
then the route tests, then the `Clock` port and the layering refactor, then
the contracts, then the transaction rules.

### B1. Portfolio performance and risk analytics

**Why next:** FR-025 (portfolio performance by period) is **P0** and is
the only P0 product requirement the backend still lacks. The dashboard
needs it. It is mostly pure domain work and depends only on B0.

**Scope** (methodology fixed by ADR-004, specified in `16-analytics-spec.md`)
- Domain: reconstruct a portfolio value time series from `COMPLETED`
  `Transaction[]` and `HistoricalPrice` (daily candles), per ADR-004
  points 1 to 3. This is the piece `PROGRESS.md` already flags as the
  reason `overview.performance` is missing.
- Performance by period (FR-025/026) as time-weighted return and absolute
  P/L from that series, with the periods `1W`, `1M`, `3M`, `6M`, `YTD`,
  `1Y`, `ALL` and a custom range; `1D` comes from `MarketPrice`.
- Portfolio-level volatility (annualized with the square root of 365, at
  least 20 returns) and drawdown on the cumulative return index
  (FR-028/029). The current asset-level calculations are generalized to
  accept a return series.
- Fees in the cost basis and in realized P/L (ADR-004 point 15), and the
  rejection of a `SELL` whose fees exceed its gross proceeds.
- API: `GET /portfolios/:id/analytics/performance`,
  and `GET .../analytics/risk` (`07-api-spec.md` §20-22). Add `performance`
  to the overview. The Pulse stays a field of the overview; a standalone
  `GET .../pulse` endpoint is `Deferred` (`07-api-spec.md` §21).
- Pulse uses the real portfolio volatility and drawdown instead of the
  largest-position proxy, with the thresholds of ADR-004 point 11.
- Attribution over a range with `from`/`to` (`07-api-spec.md` §22).
- The What Changed read model (ADR-010 point 1, FR-006), built in the
  application layer and returned as a field of the overview response, not as
  its own endpoint (decided 2026-10-08; its shape is defined in B1).

**Settled by the ADRs** (these were open decisions in the first version of
this file):
1. Return methodology: time-weighted return, with `BUY` as an external
   inflow and `SELL` as an outflow (ADR-003 point 3, ADR-004 points 2 to 4).
2. Periods and `1D`: ADR-004 point 5; a period that starts before the first
   data is clamped and states `effectiveFrom` (point 6).
3. Days without prices: the last close is carried forward; an asset that
   never had a price is `InsufficientData` (ADR-004 point 7). Unavailable
   values are `null` with a `status` of `OK`, `INSUFFICIENT_DATA` or
   `UNKNOWN`, never `0` (ADR-002 point 10).
4. Sector grouping is `Deferred` and removed from the `groupBy` options
   (ADR-004 point 13). Version 1 is single-currency (point 12).

**Deferred detail assigned to B1**

| Item | Source |
|---|---|
| A `SELL` with `fees > quantity × price` is rejected with 400; fees equal to the gross proceeds are accepted | ADR-004 |
| Period P/L boundaries: `V(day before from)` and flows over `[from, to]`; clamped periods use `V(effectiveFrom)` and flows over `(effectiveFrom, to]` | ADR-004 |
| One pure function maps a preset period and `to` to `from`, with tests for month-end, leap-year and `YTD` cases | ADR-004 |
| Returns computed in `Decimal` and converted only in the presenter | ADR-004 |
| `averageEntryPrice` includes `BUY` fees; `SELL` fees reduce realized P/L | ADR-004 |
| Pulse thresholds keep their constants, lose the placeholder comment and get boundary tests | ADR-004 |
| Volatility always annualizes with the square root of 365 and needs 20 returns; Pulse volatility thresholds are 20% and 60% | ADR-004 |
| Day boundaries are UTC calendar dates everywhere | ADR-004 |
| Ties for the largest contributor or detractor go to the alphabetically first symbol | ADR-010 |
| A position that opens and closes in the same period reports both events, in date order | ADR-010 |

**Done when:** hand-computed unit tests for the series and each metric;
integration tests for the three endpoints and the overview field; no
fabricated numbers anywhere (absent or `UNKNOWN` instead); `07-api-spec.md`
§20-22 reconciled; the missing overview integration test for `dailyChange`
and `pulse` added while the overview is being touched.

**Size:** large.

### B2. Authentication and RBAC

**Scope** (ADR-005; permission checks live in the application layer built
in B0)
- `POST /auth/logout` (FR-003, P0; `07-api-spec.md` §9) and
  `POST /auth/refresh`: the refresh token is an opaque value stored hashed
  in a sessions table, sent in an `HttpOnly`, `Secure`, `SameSite=Strict`
  cookie on `Path=/api/v1/auth`, and rotated on every use. Presenting an
  already-rotated token revokes the whole family. Both endpoints require a
  custom request header (ADR-005 points 5 to 7).
- Login response `{ user, session: { accessToken, expiresAt } }`; the
  access token is a 15-minute JWT sent as a Bearer header (points 4 and 8).
- Roles `VIEWER`, `TRADER`, `ADMIN` with an explicit permission matrix
  (`09-security-spec.md` §12-17): the existing `USER` role migrates to
  `TRADER`, `ANALYST` is dropped, code checks permissions and never role
  names (points 1 and 2).
- Permission checks through the `Actor` in the application layer, applied to
  the existing routes. Express middleware only authenticates and builds the
  `Actor`; the permission and ownership checks run in the application layer
  (point 3).
- `VIEWER` self-service: a `VIEWER` may update its own preferences and mark
  its own notifications read, and mutates no domain data. `ADMIN` has
  `TRADER` plus `simulation:control` and nothing else in version 1
  (point 13).
- Role changes take effect at the next refresh (point 9); unknown roles in
  an old token are rejected with 401.
- The `auth.logout` log entry at `info` with `userId` only (ADR-009
  point 9), emitted through the logger once B3 exists; B2 does not need to
  wait for it. The other auth security events of `09-security-spec.md` §50
  follow ADR-009 point 9.
- Expired-token and wrong-signature tests, written with the `Clock` port
  from B0 (`15` §17).
- The auth-focused security review (decided 2026-10-08): B2 owns the review
  of sessions, roles, permissions and token handling, against the checks of
  `15-implementation-plan.md` §33 that concern them. B7 owns the final pass
  (see B7).

**Settled by the ADRs** (these were open decisions in the first version of
this file): role names (`VIEWER`, `TRADER`, `ADMIN`); the permission
matrix, maintained in `09-security-spec.md`; token transport (Bearer access
token in memory, refresh token in an `HttpOnly` cookie, CSRF handled by
`SameSite=Strict` and the custom header, so `09-security-spec.md` §23 holds
without CSRF tokens); logout semantics (the session is revoked and the
cookie cleared, an issued access token stays valid until it expires, at most
15 minutes); refresh tokens are in. Registration is out of scope (ADR-005
point 10).

**Deferred detail assigned to B2**

| Item | Source |
|---|---|
| Parallel refreshes (tabs, retries, a lost response): single-flight refresh in the client plus a grace window of about 10 seconds in which the just-rotated token returns the same new pair; a concurrent-refresh test covers it | ADR-005 |
| The grace window re-sends the same successor refresh token, kept recoverable (encrypted at rest in the sessions table) for the window only; tests cover parallel refreshes and a lost first response and prove no revocation occurs | ADR-005 |
| The token family and its cookie get an idle timeout and an absolute lifetime (`expiresAt` in the sessions table, cookie `Max-Age`) | ADR-005 |
| `USER` to `TRADER` enum migration is hand-written (`RENAME VALUE`, `ADD VALUE 'VIEWER'`, updated default) because the generated one fails on existing rows | ADR-005 |
| The `Secure` cookie on the local production stack: serve on `localhost` and document it, or make `Secure` environment-dependent | ADR-005 |

**Done when:** authorization tests cover allowed role, denied role,
cross-user access and escalation attempts (`09-security-spec.md` §55);
logout and refresh behavior is tested for the semantics above; the SDD role
model is reconciled; the auth-focused security review is recorded.

**Size:** medium (a sessions table and migration, the enum migration, the
refresh flow).

### B3. Observability foundation

**Scope** (ADR-009; backend only)
- A `Logger` port in `@trading/application` (built in B0) with a `pino`
  adapter in the API, `pino-http` for request logs and `pino-pretty` in
  development only. Structured JSON on stdout with stable dotted event
  names, no log files and no rotation (`13-observability-spec.md` §33,
  ADR-009 points 1 to 3).
- Replace `console.log`; log per request with `requestId`, propagated
  through `AsyncLocalStorage`; classify errors in the error handler by code
  (`FORBIDDEN` and `RATE_LIMITED` at `warn`, `DEPENDENCY_ERROR` at `error`
  with the stack); the unexpected-error line is `http.request.failed`
  (ADR-009 points 5 and 6).
- Redaction of passwords, the `Authorization` header, cookies, access
  tokens and refresh tokens, enforced by tests (point 4).
- `LOG_LEVEL` (`debug` in development, `info` in production, `silent` in
  tests) and `SLOW_REQUEST_THRESHOLD_MS` (default 500) for the slow-request
  `warn`; the analytics series reconstruction is timed separately
  (points 7 and 8).
- Security events `auth.login.succeeded`, `auth.login.failed`,
  `auth.refresh.reuse_detected` and `authz.denied` (point 9).
- One log entry when a stored scenario `changes` entry is skipped by the defensive
  read, so corruption can surface (decided 2026-10-08, `PROGRESS.md` §7).
- CORS `exposedHeaders` so the browser can read the `X-Request-ID` response
  header (point 5).
- Graceful shutdown (ADR-006 point 12): on `SIGTERM` or `SIGINT` the server
  stops accepting connections, `GET /health/ready` returns 503 with
  `status: "unavailable"` and no `checks`, in-flight requests drain with a
  10-second timeout, Prisma is closed, and the process exits with code 1 if
  the drain expires and 0 otherwise.
- Lifecycle entries `app.startup.started`, `app.startup.completed`,
  `app.shutdown.started` and `app.shutdown.completed` (point 11). Job
  transitions and realtime connection events are added by B4 and B5.
- Hooks the later blocks use for job and realtime lifecycle events
  (`13-observability-spec.md` §43, §28).

**Settled by the ADRs** (these were open decisions in the first version of
this file): the logger library is `pino`; **metrics are `Deferred`**: there
is no `/metrics` endpoint and no metrics library until something consumes
them (ADR-009 point 10). `LOG_FORMAT`, `ENABLE_DEBUG_LOGGING` and
`ENABLE_DEV_DIAGNOSTICS` are not adopted.

**Deferred detail assigned to B3**

| Item | Source |
|---|---|
| Redaction also covers the response `set-cookie` header, the access token inside the WebSocket authentication message and the stored CSV input (job input is never logged); each case has a test | ADR-009 |
| Tests that assert `requestId` in log entries inject a capturing logger at `info`; `silent` stays the default elsewhere | ADR-009 |
| `source`, `module`, `resourceType`, `resourceId` and `operationId` are not logged in version 1; `requestId`, `jobId` and `connectionId` are the correlation fields | ADR-009 |
| Individual database operations are not timed and Prisma query logging stays off | ADR-009 |

**Done when:** the unit and integration tests in `13-observability-spec.md`
§59-61 exist (§62 is the frontend E2E scenarios); request correlation is
verified from request to log; sensitive fields never reach a log; the
shutdown sequence is tested; a developer can answer the questions in
`13-observability-spec.md` §75 for a reproduced failure.

**Size:** medium.

### B4. Background jobs and idempotency

**Scope** (ADR-008)
- The use case is the CSV transaction import (FR-069 and its siblings): two
  stages, validate every row with progress and then apply all rows in a
  single `UnitOfWork`, so no partial import can exist. Rows follow ADR-003
  (`BUY` and `SELL` only, chronological validation) and ADR-004 (the asset
  currency must match the portfolio's).
- A `jobs` table (a new migration; none exists) and an `idempotency_keys`
  table. Job states `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`,
  `CANCELLED`, `TIMED_OUT`; progress (`processed`, `total`) is a field, not a
  state. The job's input is stored in its row and cleared for `COMPLETED`
  jobs and for jobs that `FAILED` with `VALIDATION_FAILED` or
  `PORTFOLIO_ARCHIVED` (the five failure reasons are the complete set,
  ADR-008 point 6).
- The in-process runner backed by the table: on startup every job left in
  `PROCESSING` becomes `FAILED` with reason `INTERRUPTED` and every `QUEUED`
  job resumes. Timeout applies while `QUEUED` or validating, never during
  apply.
- `POST /portfolios/:portfolioId/imports`, `GET /jobs/:jobId`,
  `POST /jobs/:jobId/retry` and `POST /jobs/:jobId/cancel`
  (`07-api-spec.md` §15-16); importing requires `transaction:create`.
  Retry is allowed for `TIMED_OUT`, `CANCELLED` and `FAILED` with reason
  `INTERRUPTED`, `APPLY_ERROR` or `APPLY_REJECTED`; cancel is allowed while
  `QUEUED` or validating. A request the state does not allow is 409.
- `Idempotency-Key` on `POST /portfolios/:id/transactions` and on import
  creation, stored per user for 24 hours with a hash of the request
  (`07-api-spec.md` §39, NFR-016); the same key with a different request is
  409 `CONFLICT`.
- Notifications for finished imports: `SUCCESS` for `COMPLETED`, `ERROR` for
  `FAILED` and `TIMED_OUT`, none for `CANCELLED` (ADR-010 point 9).
- Job lifecycle events through the logger (B3), and `jobs:{jobId}` events
  delivered by B5.
- The job runner joins the graceful shutdown sequence built in B3
  (ADR-006 Deferred detail).

**Settled by the ADRs** (these were open decisions in the first version of
this file): what runs as a job (the CSV import; transactions stay
synchronous and `07-api-spec.md` §14 loses the asynchronous flow, ADR-008
point 12); the runner is in-process and backed by the table, with no
separate worker; jobs survive a restart (points 4 and 5). Input limits
(file size, row count) and the CSV parsing dependency are fixed in B4
(points 10 and Consequences).

**Deferred detail assigned to B4**

| Item | Source |
|---|---|
| Apply re-checks invariants inside the `UnitOfWork`: a business-rule rejection ends `FAILED` with reason `APPLY_REJECTED` (retry re-runs validation), a technical failure with `APPLY_ERROR` (retryable) | ADR-008 |
| Two in-flight requests with the same `Idempotency-Key`: the key is reserved with a unique constraint and the second request gets 409 | ADR-008 |
| Every transition is a compare-and-set on status with a persisted `stage` and `attempt`; the apply `UnitOfWork` sets `COMPLETED` conditionally and rolls back if no row matches | ADR-008 |
| The idempotency key and response are written in the same `UnitOfWork` as the mutation; reservations have a lease; 5xx outcomes are not stored | ADR-008 |
| The request hash includes method, route and path parameters; expired rows are purged or treated as absent | ADR-008 |
| The timeout is measured per attempt from when the job was queued; startup handling of jobs past their deadline is defined | ADR-008 |
| Retry requires `transaction:create`; cancel requires `transaction:create` on an owned job | ADR-008 |
| The CSV transport for `POST .../imports` and its route-specific body limit (the global JSON limit is 100 kB) are set with the input limits | ADR-008 |
| A portfolio archived while its import is `QUEUED` or `PROCESSING`: the job checks the status inside the apply `UnitOfWork` and fails with the non-retryable reason `PORTFOLIO_ARCHIVED`, writing nothing and clearing the stored input | ADR-008, ADR-010 |
| The shutdown steps for background jobs are added to the shutdown sequence when the job runner exists | ADR-006 |

**Done when:** state-transition tests including failure, timeout, retry and
cancel; idempotency tests for duplicate and concurrent submissions;
in-flight jobs behave correctly on shutdown (the runner joins the B3
sequence); `07-api-spec.md` §14 reconciled.

**Size:** medium to large.

### B5. Realtime

**Scope** (`08-realtime-spec.md`, FR-044 to FR-053; ADR-007)
- WebSocket server with the `ws` library behind a transport port, served by
  the same HTTP server and port as the API on a fixed path (proposed
  `/ws`, confirmed here; there is no `WEBSOCKET_PATH` variable). The access
  token is sent in the first message, never in the URL; a connection not
  authenticated within 5 seconds is closed; each socket is bound to the
  token's expiry and re-authenticates over the same socket after a refresh
  (ADR-007 points 1 and 2).
- Channel authorization in the application layer, by permission and
  ownership: `portfolio:{portfolioId}`, `market:{assetId}`, `jobs:{jobId}`
  and `notifications`, which is scoped to the authenticated user (point 3).
- Typed, validated event envelope `{ id, type, channel, sequence, timestamp,
  payload }` as Zod schemas in `@trading/contracts`, with a per-channel
  monotonic `sequence`. `MarketEvent` already has a `sequence` column.
- The `RealtimePublisher` port in `packages/application`, with its adapter
  in `apps/api` behind the transport port. Application services publish
  after the change commits (for example `PORTFOLIO_UPDATED` after a
  transaction commits); version 1 has no domain events and no event bus
  (ADR-007 point 17).
- The event catalog of version 1 is seven events: `MARKET_PRICE_UPDATED`,
  `PORTFOLIO_UPDATED`, `NOTIFICATION_CREATED`, `ALERT_TRIGGERED` (delivered
  on `notifications`) and the job events `JOB_PROGRESS_UPDATED`,
  `JOB_COMPLETED` and `JOB_FAILED` (`08-realtime-spec.md` §15). Cancelled
  and timed-out jobs emit no realtime event.
- The simulation engine as the pure package `packages/market-sim`
  (`@trading/market-sim`), with a seeded generator and an injected `Clock`,
  used by this server and by the demo. The server drives it as a
  server-side price source behind a market-data adapter
  (`04-tech-stack.md` §47-48): each tick updates `MarketPrice` and appends a
  `MarketEvent`, and at every UTC day rollover the simulator closes a daily
  `HistoricalPrice` candle and rolls `previousPrice` (points 7, 8 and 14).
- Control endpoints `POST /api/v1/simulation/start`,
  `POST /api/v1/simulation/pause` and `PUT /api/v1/simulation/mode`,
  requiring `simulation:control` (`ADMIN`). The lifecycle state is
  `RUNNING <-> HALTED`; `PAUSED` stays only as a mode wire identifier
  (points 10, 15 and 16).
- The notification producer for triggered alerts, realtime delivery of the
  job events and of `NOTIFICATION_CREATED` (the import notifications are
  created in B4, see B4 scope), and alert
  evaluation that is edge-triggered, so an alert never repeats on every
  tick (FR-053, ADR-007 point 9, `12-demo-mode-spec.md` §45).
- Limits (point 15): 50 subscriptions and 20 inbound messages per second
  per connection, a 1 MB outbound buffer, a ping every 30 seconds with
  close after two missed pongs, close codes `4001`, `4002`, `4008` and
  `1001`, and a per-user cap of 5 concurrent connections where the new
  connection closes with `4008` and existing ones stay open (ADR-005
  point 13, ADR-007 point 16).
- Resynchronization through HTTP is client work (`08-realtime-spec.md`
  §25-26, FE3); the server keeps no replay buffer (point 5). Server-side
  limits and bounds are `08-realtime-spec.md` §7, §48, §51-52 and §55, and
  `09-security-spec.md` §31-35.
- The realtime connections join the graceful shutdown sequence built in B3
  (close code `1001`), and the simulator log entries `simulation.started`,
  `simulation.paused` and `simulation.mode.changed` are added (ADR-009
  point 11).
- Performance measurement (decided 2026-10-08): B5 owns it, because it can
  only be taken once realtime exists. The frontend side is measured in FE5.
  ADR-009 metrics stay `Deferred` (ADR-009 point 10).

**Settled by the ADRs** (these were open decisions in the first version of
this file): the simulation engine is one shared package, `packages/market-sim`
(ADR-007 point 7); the WebSocket library is `ws` (point 1); the first
version ships the seven events above, not the eleven of the original
`08-realtime-spec.md` §15 (point 6 removed `TRANSACTION_CREATED`,
`TRANSACTION_COMPLETED` and `POSITION_UPDATED`).

**Deferred detail assigned to B5**

| Item | Source |
|---|---|
| `Position.currentPrice` stays at the opening trade price while `MarketPrice` ticks: drop it and read `MarketPrice` at query time, or update it on every tick | ADR-007 |
| Events lost between the HTTP fetch and the subscription, a job finishing before `jobs:{id}` is subscribed, and sequences restarting at 1 after a restart: subscribe first and buffer, fetch a snapshot carrying its sequence, and add a per-process epoch to the envelope | ADR-007 |
| Alert `armed` and `lastTriggeredAt` are persisted in the same transaction as the notification; re-arm only past a hysteresis band or after a cooldown; the initial state of a new, already-true alert is defined | ADR-007 |
| After a restart the engine initializes from the persisted `MarketPrice` and `MAX(sequence)` per asset; `(assetId, sequence)` is unique | ADR-007 |
| Re-authentication on the same socket with another user's token is rejected and the socket closes | ADR-007 |
| WebSocket `maxPayload` starts at 64 KiB (65,536 bytes) per inbound message, adjustable during B5 if a measured need appears | ADR-007 |
| The realtime hub sits behind its own interface; version 1 has no broker | ADR-007 |
| What the `PAUSED` mode does relative to `HALTED`, and which mode `start` resumes into | ADR-007 |
| Bounded retention of `MarketEvent` rows | ADR-007 |
| The numeric value of the per-user connection cap (starts at 5, tuned against real usage) | ADR-005 |
| Each connection logs its own `connectionId`; reconnects are correlated by `userId`; `simulation.error` is not logged until simulator errors are defined | ADR-009 |
| The shutdown steps for realtime connections are added to the shutdown sequence | ADR-006 |

**Done when:** connection, auth, subscription, ordering, duplicate and
stale-event, reconnect and unauthorized-channel tests
(`08-realtime-spec.md` §59); notifications and alerts generated by real
events; realtime failure degrades to HTTP.

**Size:** large. Plan it as several slices, starting with the transport
alone (`15-implementation-plan.md` §14 recommends exactly that order).

### B6. API documentation and contract

**Scope**
- An OpenAPI document covering every endpoint, the error schema,
  authentication and examples (`04-tech-stack.md` §21,
  `07-api-spec.md` §57), generated from the `@trading/contracts` schemas
  with Zod v4's `toJSONSchema` (ADR-002 point 7). No hand-maintained API
  document.
- The contract tests exist since B0 (ADR-002 point 6); this block adds the
  generated document and keeps the same schemas usable to validate the
  demo's in-process adapters (`07-api-spec.md` §56,
  `10-testing-strategy.md` §52).

**Why here:** it documents the final surface, so it waits until B1 to B5
have added their endpoints. It must be done before the frontend, because
the demo's adapters are checked against it.

**Done when:** every route is documented, the document is generated from
code (not hand-maintained), and a test fails when a route and its schema
drift apart.

**Size:** medium.

### B7. Deployment readiness and hardening

**Scope** (`14-deployment-spec.md`, backend side; ADR-006)
- Fix the production build path (`PROGRESS.md` §7): every workspace package
  compiles to `dist` and exposes it through `exports`, and the API runs with
  `node dist/index.js` (ADR-006 point 3). CI already builds the packages
  from B0; running the built API is this block.
- `apps/api/Dockerfile`: multi-stage, non-root, built with the workspace
  root as the build context, entrypoint `node dist/index.js` with no shell
  or package-manager wrapper, `TZ=UTC`, and a healthcheck on
  `GET /health/ready` (ADR-006 point 4).
- The Compose `full` profile (PostgreSQL and API; the default profile keeps
  only PostgreSQL) with a one-shot `migrate` service that runs
  `prisma migrate deploy`, and the API waits for it with
  `service_completed_successfully`. The seed never runs automatically.
- `DATABASE_URL` validation at startup (`15` §8).
- The smoke test (`14-deployment-spec.md` §49): one script after
  `docker compose --profile full up`, with no frontend step. The stack runs
  with `NODE_ENV` other than `production`, and the script runs `db:seed` as
  an explicit step before it logs in; the production guard of B0 stays
  untouched (ADR-006 point 11).
- Security checklist (§78): secrets, CORS, headers, error exposure, health
  output, resource limits.
- The final security pass (decided 2026-10-08): B7 owns it, using the
  checklist of `15-implementation-plan.md` §33 over the whole backend. The
  auth-focused review stays with B2.
- Known debts that belong here: the unescaped `%`/`_` in the assets search
  filter (`packages/database/src/repositories/prisma-asset-repository.ts`;
  the transactions list has no free-text search, ADR-010 point 2).
  `PROGRESS.md` §7 lists Assets and Transactions, but only assets has a
  `contains` filter.
- A database recovery log entry is not part of version 1; ADR-009 leaves it
  to be reconsidered when the API healthcheck exists, so B7 decides it
  there.
- Backups are documented as not applicable to a local environment, not
  claimed (ADR-006 point 9).

**Note:** CI is not part of this block. ADR-006 points 10 and 11 define a
minimal CI built in B0; this block adds the smoke test that runs against the
`full` profile. Graceful shutdown is built in B3 (ADR-006 point 12), and the
position-recalculation race is fixed in B0 (ADR-001).

**Deferred detail assigned to B7**

| Item | Source |
|---|---|
| The `migrate` service has `depends_on` PostgreSQL with `condition: service_healthy`, and the API waits for `migrate` with `service_completed_successfully` | ADR-006 |
| `connection_limit` of the Prisma pool in the `full` profile stays at Prisma's default until measured | ADR-006 |
| The smoke script seeds before it logs in, and running the seed with `NODE_ENV=production` is still refused | ADR-006 |
| No database recovery entry (and no `dependency.recovered`) because readiness is stateless; reconsidered when the API healthcheck exists | ADR-009 |

**Done when:** a production build runs from a clean checkout in a
container, the smoke test passes against the `full` profile, and the
checklist is ticked with evidence, including the final security pass over
the §33 checklist.

**Size:** medium.

---

## 4. Small items to fold into the blocks (not separate work)

| Item | Fold into |
|---|---|
| Overview integration test for `dailyChange` and `pulse` | B1 |
| `tokenFor` migration in older tests | B2 *(unverified)* |
| Alignment of the `typescript` and `@types/node` versions across packages | B0 (`Implemented` in B0.1) |
| Event ordering tiebreaker beyond `timestamp` | B5 (events created in bursts) |
| `ScenarioRepository.updateChanges` has no production caller | decide when the demo adapters are written |
| Wildcard escaping in the assets search | B7 |
| Position recalculation race | B0 (ADR-001) |

---

## 5. Specification inconsistencies to settle

These were contradictions inside the SDD, found while building. Items 1 to
3 are settled by ADRs; the documents they touch are aligned as each is
reconciled (`docs/README.md`). Item 4 is open.

1. **Roles.** Settled by ADR-005 point 1: `VIEWER`, `TRADER`, `ADMIN`. The
   code still has `USER` and `ADMIN` until B2 migrates it.
2. **Cash and transaction types.** Settled by ADR-003: version 1 supports
   `BUY` and `SELL` only, with no cash balance and no `cashValue`;
   `DEPOSIT`, `WITHDRAWAL`, `DIVIDEND` and `FEE` are `Deferred`.
3. **Token transport.** Settled by ADR-005 points 4 to 7: a Bearer access
   token in memory plus an `HttpOnly` refresh cookie limited to the auth
   endpoints. The code still returns a single Bearer token until B2.
4. **Stale cross-references.** Several documents reference each other by
   old numbers (for example `08-realtime-spec.md` is titled "07",
   `12-demo-mode-spec.md` cites `05-architecture.md` and `06-api-spec.md`,
   `01-product-spec.md` §8 cites `06-data-model.md`). Documentation
   hygiene only; fix each document when it is next touched.

---

## 6. Handoff to the frontend and demo

What the web app and the in-process demo adapters will consume, and what
must exist before starting them:

- **Pure domain functions to share, not rewrite:** `projectDecisionReplay`,
  `compareScenarioImpacts`, `calculateScenarioImpact`, the portfolio and
  position metrics, allocation, attribution, pulse, and the B1 additions.
- **The application layer** (`@trading/application`, B0): the use cases the
  demo runs in process, with the in-memory repositories and `UnitOfWork`
  that the B0 contract suite proves equivalent to the Prisma ones.
- **Repository contracts** in `packages/domain`, including the documented
  behaviors an in-memory implementation must respect (for example the
  scenario list order and `UnitOfWork`).
- **`@trading/contracts`** (B0): the DTOs, schemas, presenters, error
  contract, pagination shape and response envelopes both adapters return.
- **The OpenAPI document** (B6).
- **The simulation engine** `@trading/market-sim` (B5).
- **Frontend-side questions** are settled in the frontend-stage ADR before
  FE0 starts (routing, state, rendering and charts, shared UI, the
  accessibility tool, the HTTP client timeout and retry, test tooling and
  the demo specifics); the frontend blocks FE0 to FE6 are defined in
  `15-implementation-plan.md` §4.3. `apps/web` holds only the wireframe, and
  `@trading/domain` still points `main` and `types` at `src/index.ts` until
  the production build path is fixed in B7.

---

## 7. Deliberately parked (not required to call the backend done)

- Decision write endpoints and the event journal endpoint
  (`PROGRESS.md` §3.7). Revisit with the frontend screen in view.
- Duplicate scenario, FR-041 (P2).
- Expected vs Actual, FR-035 (P2), and global search, FR-054 (P2).
- Transaction types beyond `BUY` and `SELL` (ADR-003 point 5), and weekly or
  monthly history intervals. Both are noted as future additions in the SDD
  or by the user.
- Allocation, risk and exposure in scenario `calculate` (FR-038): only total
  value and unrealized P/L are derivable honestly today. B1 may unlock part
  of it.
- Decision replay limits, revisited with the FE2 decisions screens (decided
  2026-10-08): the `riskLevel` replay limitation (needs a new field) and the
  `NEUTRAL` direction P/L, computed as `LONG` (`PROGRESS.md` §7).
- Metrics and a `/metrics` endpoint (ADR-009 point 10), hosting the backend
  (ADR-006 point 2) and benchmark comparison (ADR-010 point 7).

---

## 8. How to work through this file

1. At the start of each block, re-verify the evidence against the code
   (this document can go stale) and take any real open question to the
   user.
2. Slices stay small and verifiable; no block is implemented in one go.
3. When a block closes: update `PROGRESS.md` (new section, commits, open
   items), reflect any SDD divergence, and mark the block here as done
   with the date.
4. Do not start the frontend until section 2 is satisfied, unless the user
   changes that decision explicitly.

### Status

| Block | Status |
|---|---|
| B0 Application layer, shared contracts and minimal CI | In progress (B0.1 done) |
| B1 Performance and risk analytics | Not started |
| B2 Auth and RBAC | Not started |
| B3 Observability foundation | Not started |
| B4 Background jobs and idempotency | Not started |
| B5 Realtime | Not started |
| B6 API documentation and contract | Not started |
| B7 Deployment readiness and hardening | Not started |
