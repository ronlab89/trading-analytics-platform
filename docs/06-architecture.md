# SDD 06 — Architecture

**Project:** Trading Analytics Platform  
**Status:** Reconciled with the monorepo and ADR-001 to ADR-009 on 2026-10-05  
**Version:** 2.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`  
**Decisions:** ADR-001 (`adr/0001-application-layer.md`), ADR-002 (`adr/0002-shared-contracts.md`), ADR-005 (`adr/0005-roles-and-authentication.md`), ADR-006 (`adr/0006-deployment-model-and-ci.md`), ADR-007 (`adr/0007-realtime-and-market-simulation.md`), ADR-008 (`adr/0008-background-jobs-csv-import.md`), ADR-009 (`adr/0009-observability-scope.md`)

---

# 1. Purpose

**Status:** `Implemented`

This document describes the layers, packages, module boundaries and
dependency rules of the repository as it exists, and the target structure
decided by the ADRs. Anything not yet in code is marked `Planned (B#)` or
`Planned (FE)` with its ADR, or `Deferred` (legend in `docs/README.md`).

Section numbers are stable because code comments cite them (§3.3, §10-13,
§29, §30, §43, §53). Sections whose former content described structure that
does not exist are kept as short stubs so numbering does not shift.

Block `B0` is the application-layer refactor named by ADR-001, ADR-002 and
ADR-003; it precedes B1-B7 of `BACKEND-ROADMAP.md`. Frontend and demo work
that an ADR already fixes is `Planned (FE)`: it is built in the frontend
stage, after the backend blocks. Frontend topics that no ADR decides are
`Deferred`.

Each section ends with **Open detail** when an edge case is undecided. Open
details do not change any ADR decision; each is assigned to a block.

---

# 2. Architectural Goals

**Status:** `Implemented` for domain-first layering; shared behavior across modes `Planned (B0)`.

1. Business rules live in one framework-free package (`@trading/domain`).
2. Persistence sits behind domain repository contracts.
3. The real application and the public demo share the same use cases and
   replace only the repositories (ADR-001).
4. One declared wire format shared by the API, the web app and the demo
   (ADR-002).
5. Infrastructure that matches the real deployment model: a local backend
   and a static public demo (ADR-006).

---

# 3. Architectural Principles

## 3.1 Domain First

**Status:** `Implemented`

`@trading/domain` contains entities, the `Money` value object, pure
calculations and repository contracts. Its only runtime dependency is
`decimal.js`; it imports no framework, ORM, HTTP or browser API.

## 3.2 Explicit Boundaries

**Status:** `Implemented` as workspace package boundaries; lint enforcement `Planned (B0)`.

Each package exposes a single barrel (`src/index.ts`). Cross-package access
goes only through `@trading/*` workspace dependencies declared in
`package.json`. Tooling enforcement is described in §43.

## 3.3 Dependency Inversion

**Status:** `Implemented` for repositories; injection into services `Planned (B0)`.

Repository and `UnitOfWork` contracts are declared in
`packages/domain/src/repositories/` and implemented in
`packages/database/src/`. The domain never imports the database package.

```text
@trading/domain   (contracts: PortfolioRepository, UnitOfWork, ...)
       ^
       | implements
@trading/database (PrismaPortfolioRepository, PrismaUnitOfWork, ...)
```

Current gap: 14 of the 15 modules in `apps/api/src/services/` instantiate
Prisma repositories at module scope, so no other implementation can be
supplied. ADR-001 points 2 and 4 replace this with factories that receive
their dependencies from a composition root.

## 3.4 Infrastructure Is Replaceable

**Status:** `Implemented` for Prisma isolation; in-memory implementations `Planned (B0)`.

Prisma is confined to `@trading/database`; `packages/database/src/client.ts`
is the only module that imports the generated client. In-memory
implementations of every contract (tests, then the demo) are required by
ADR-001 (Consequences).

## 3.5 Avoid Premature Distribution

**Status:** `Implemented`

One API process and one PostgreSQL database. ADR-006 keeps the backend
local-only, ADR-008 keeps jobs in process without an external queue, and
ADR-009 defers metrics. Distribution requires a new ADR.

---

# 4. High-Level Architecture

**Status:** `Implemented` (current packages); target packages `Planned (B0)` and `Planned (B5)`.

pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`). No task
runner; root scripts use `pnpm -r` and `tsc --build` with project
references to `packages/domain`, `packages/database` and `apps/api`.

| Path | Package | State |
| --- | --- | --- |
| `packages/domain` | `@trading/domain` | `Implemented` |
| `packages/database` | `@trading/database` | `Implemented` |
| `apps/api` | `@trading/api` | `Implemented` |
| `packages/application` | `@trading/application` | `Planned (B0)` — ADR-001 |
| `packages/contracts` | `@trading/contracts` | `Planned (B0)` — ADR-002; folder exists with `.gitkeep` only |
| `@trading/market-sim` | `@trading/market-sim` | `Planned (B5)` — ADR-007 point 7; the package lives at `packages/market-sim` |
| `apps/web` | none | `Planned (FE)` — ADR-002 point 5, ADR-006 point 1; wireframe files only, not a workspace package |
| `packages/config` | none | `Deferred` — `.gitkeep` only; no decision gives it content |

---

# 5. System Context

**Status:** `Implemented` (local backend); public demo `Planned (FE)` — ADR-006 points 1, 7.

```text
HTTP client (tests, curl) --HTTP--> @trading/api (Express, port 7001) --Prisma--> PostgreSQL 18 (docker-compose)
```

There is no web client yet. ADR-006 fixes exactly two targets: the local
full stack and a static demo build of `apps/web` with no backend. No public
backend exists or is planned.

---

# 6. Execution Modes

## 6.1 Demo Mode

**Status:** `Planned (FE)` — ADR-001 point 4, ADR-002 point 5, ADR-006 point 7.

The demo runs the real `@trading/application` use cases in the browser,
composed with in-memory repositories, behind the `TradingClient` in-process
adapter. It calls no backend, holds no secrets, uses namespaced browser
storage and runs under a configurable base path. There is no mock HTTP
layer (ADR-001, Alternatives).

## 6.2 Production Mode

**Status:** `Implemented` (local only); `APP_MODE` `Planned (FE)` — ADR-006 point 8.

ADR-006 calls this the real mode (`APP_MODE=real`; `VITE_APP_MODE` in the
web build). It runs only on the author's machine. `APP_MODE` is not read by
the API today.

---

# 7. Frontend Architecture

**Status:** `Planned (FE)` — ADR-002 point 5, ADR-005 point 4, ADR-007 point 13; `apps/web` holds only `wireframe.html` and `WIREFRAME-PLAN.md`.

Already decided, to apply in the frontend stage:

- The UI consumes DTOs only through a `TradingClient` port with an HTTP
  adapter and an in-process adapter (ADR-002 point 5).
- The access token is kept in memory only (ADR-005 point 4); a 401 triggers
  one refresh and retry (ADR-005, Consequences).
- Realtime goes through a client-side port with a WebSocket adapter and an
  in-process adapter fed by `@trading/market-sim` (ADR-007 point 13).

Open detail (FE): workspace location and package name of
`apps/web`, and how it consumes workspace packages before B7 builds them
(`BACKEND-ROADMAP.md` §6).

---

# 8. Feature Modules

**Status:** `Deferred` — frontend; no ADR decides it; see §7.

---

# 9. Shared Layer

**Status:** `Implemented` as workspace packages; frontend shared UI `Deferred`.

Code shared between runtimes lives in workspace packages, never in an app:
`@trading/domain` today; `@trading/application`, `@trading/contracts` and
`@trading/market-sim` when built (§4).

---

# 10. Domain Layer

**Status:** `Implemented`

`packages/domain/src/`:

| Folder | Contents |
| --- | --- |
| `entities/` | 16 entities plus `enums.ts`, with their validators and `Invalid*Error` classes |
| `value-objects/` | `money.ts` (`Money`, `InvalidMoneyError`, `CurrencyMismatchError`) |
| `calculations/` | `allocation`, `attribution`, `decision-replay`, `drawdown`, `portfolio-daily-change`, `portfolio-metrics`, `portfolio-pulse`, `position-metrics`, `position-recalculation`, `scenario-comparison`, `scenario-impact`, `volatility` |
| `repositories/` | 16 repository contracts, `UnitOfWork`, `pagination.ts` (`Page`, `PageRequest`) |

Rules:

- Calculations are pure and deterministic: no I/O, no clock reads, no
  randomness. Callers pass in every input.
- Domain errors are plain `Error` subclasses named `Invalid*Error` or
  `Insufficient*Error`; they carry no transport concept (§29).
- Money is `Money` over `Decimal`, never a JavaScript number
  (`05-data-model.md`).
- Repository contracts document ordering and behavior precisely enough to be
  implemented in memory (ADR-001, Consequences).

Portfolio-level performance and risk calculations are `Planned (B1)`
(ADR-004, `16-analytics-spec.md`).

---

# 11. Application Layer

**Status:** `Implemented` inside `apps/api/src/services/`; `@trading/application` `Planned (B0)`.

Today the use cases are the 15 modules in `apps/api/src/services/`, one per
resource. They check ownership, call domain validators and calculations,
compose read models (overview, scenario calculate and compare, decision
replay, allocation, attribution) and throw `AppError` with HTTP status codes
(11 modules).

Target (ADR-001):

1. `@trading/application` depends only on `@trading/domain`; no Prisma,
   Express, Zod transport schemas or browser APIs (enforced by lint, §43).
2. One factory per resource returning the current functions, for example
   `createPortfolioService({ portfolioRepository })`. No use-case classes or
   command bus.
3. Callers pass an `Actor { userId, role }` instead of a bare `userId`; every
   use case checks permission and ownership (ADR-005 point 3).
4. Transport-free errors defined in the application package (§29).
5. Composite read models belong here (ADR-001 point 6).
6. Unit tests use in-memory fake repositories (§60).

Later additions to the same package: the `Logger` port (ADR-009 point 1,
`Planned (B3)`), the CSV import use case (ADR-008, `Planned (B4)`) and
realtime subscription authorization (ADR-007 point 3, `Planned (B5)`).

---

# 12. Repository Pattern

**Status:** `Implemented`; in-memory implementations `Planned (B0)`.

- Contracts: `packages/domain/src/repositories/*-repository.ts`, exported as
  types from `@trading/domain`.
- Implementations: `packages/database/src/repositories/prisma-*-repository.ts`,
  exported from `@trading/database`. Each accepts an optional
  `DatabaseClient` (the shared client or a transaction client) so it can
  join a unit of work.
- Mapping between Prisma rows and domain entities: `packages/database/src/mappers/`.
- Paginated list methods take `PageRequest` and return `Page<T>`.

A contract method exists only when a use case needs it; contracts are not
generic CRUD interfaces.

---

# 13. Mock Infrastructure

**Status:** `Planned (B0)` for in-memory repositories and `UnitOfWork`; demo wiring `Planned (FE)` — ADR-001 point 4.

In-memory implementations of every repository contract and of `UnitOfWork`
(with rollback) are built for the application unit tests in B0 and become
the demo's repositories (ADR-001). The Prisma adapter follows the same
isolation rule (§3.4).

Open detail (B0): the package that hosts the in-memory implementations so
both the tests and the web build can import them.

---

# 14. Mock Data Engine

**Status:** `Implemented` for the seed (`packages/database/src/seed`); demo data `Deferred`.

The seed is an explicit development command (`db:seed`), never run
automatically (ADR-006 point 5). Demo data layers are specified in
`05-data-model.md` §33-35 and `12-demo-mode-spec.md`.

---

# 15. Mock API Simulation

**Status:** `Deferred` — superseded by ADR-001 and ADR-002.

No mock HTTP layer is built. The demo calls the application layer in
process (§6.1).

---

# 16. Failure Injection

**Status:** `Planned (FE)` for CSV import failure injection in the demo — ADR-008 point 13; other demo failure injection `Deferred`.

---

# 17. State Management Strategy

**Status:** `Deferred` — frontend; no ADR decides it; see §7.

---

# 18. State Ownership

**Status:** `Implemented` on the server; client state `Planned (FE)` — ADR-002 point 5, ADR-005 point 4.

PostgreSQL is the source of truth for persisted state; derived values
(metrics, allocation, replay state) are computed on read and never stored
(`05-data-model.md`). On the client, server state arrives only through
`TradingClient` DTOs (ADR-002) and the access token lives in memory only
(ADR-005).

---

# 19. Server State Synchronization

**Status:** `Planned (FE)` — ADR-007 points 5, 12; transport rules in §20-23.

On a sequence gap the client resynchronizes through HTTP; while the socket is
down it shows a stale-data indicator and refetches periodically.

---

# 20. Real-Time Architecture

**Status:** `Planned (B5)` — ADR-007.

- Transport: WebSocket with the `ws` library, behind a transport port.
- Channels: `market:{assetId}`, `portfolio:{portfolioId}`, `notifications`
  (per user), and `jobs:{jobId}` (ADR-008 point 11). Job events are
  `Planned (B5)`: the job lifecycle lands in B4, but the events need this
  B5 transport.
- Every subscription is authorized in the application layer by permission
  and ownership.
- Envelope `{ id, type, channel, sequence, timestamp, payload }` as Zod
  schemas in `@trading/contracts`; money in the ADR-002 wire format.
- Limits: subscriptions per connection, inbound rate limit, heartbeat every
  30 seconds, bounded memory per connection.

Today the API has no WebSocket server and no `ws` dependency.

---

# 21. Event Model

**Status:** `Planned (B5)`, including job events (§20).

| Event | Emitted when |
| --- | --- |
| `MARKET_PRICE_UPDATED` | Each simulator tick |
| `PORTFOLIO_UPDATED` | Holdings change, after the transaction commits |
| `NOTIFICATION_CREATED` | A notification is created |
| `ALERT_TRIGGERED` | An alert condition turns from false to true (on `notifications`) |
| `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED`, `JOB_FAILED` | Job progress, `COMPLETED` and `FAILED` (ADR-008); `CANCELLED` and `TIMED_OUT` emit none (ADR-007 point 15) |

`TRANSACTION_CREATED`, `TRANSACTION_COMPLETED` and `POSITION_UPDATED` are
removed (ADR-007 point 6).

---

# 22. Real-Time State Updates

**Status:** `Planned (B5)` — ADR-007 points 6, 12, 14.

The client recomputes valuations from price events; the server does not
push per-portfolio valuations on ticks. `MarketPrice.change` and
`changePercent` stay measured against the last closed daily candle; the
tick-to-tick delta exists only in the event payload. While the socket is
down, the UI shows stale data and refetches over HTTP.

---

# 23. Real-Time Connection Lifecycle

**Status:** `Planned (B5)` — ADR-007 points 2, 5, 11.

```text
connect -> first message carries access token (closed if absent after 5 s)
        -> socket bound to that token's expiry
        -> client re-authenticates after each refresh (role and ownership reloaded)
        -> token expires without re-authentication: server closes the socket
sequence gap on a channel -> client resynchronizes over HTTP (no replay buffer)
```

---

# 24. Backend Architecture

**Status:** `Implemented`

`apps/api` is an Express 5 application. `src/app.ts` builds the app without
listening (used by supertest); `src/index.ts` listens on `env.PORT`.

Middleware order in `createApp`:

```text
helmet -> cors(CORS_ORIGIN) -> requestId -> health routes -> general rate limiter
       -> express.json(100kb) -> resource routers -> 404 (AppError) -> errorHandler
```

Request path inside a router:

```text
route -> authenticate -> validate(schema, source) -> controller -> service -> repository / UnitOfWork
```

---

# 25. Backend Module Structure

**Status:** `Implemented`; relocation of services `Planned (B0)`.

`apps/api/src/` is organized by technical layer, one file per resource:

| Folder | Contents |
| --- | --- |
| `config/` | `env.ts` (validated environment, §45) |
| `routes/` | 15 routers (`health.ts`, `*.routes.ts`) |
| `controllers/` | 15 controllers: read `req.auth`, params and validated input, call services, send JSON |
| `services/` | 15 service modules (§11) |
| `schemas/` | 13 Zod request schemas |
| `middleware/` | `authenticate`, `error-handler`, `rate-limit`, `request-id`, `validate` |
| `errors/` | `app-error.ts` |
| `test-utils/` | `api-client`, `auth`, `fixtures` |

Resources: alerts, analytics, assets, auth, decisions, health, market,
notifications, overview, portfolios, positions, preferences (user
preferences), scenarios, transactions, watchlist.

Target (ADR-001 point 4, ADR-002 point 2): services move to
`@trading/application`, schemas to `@trading/contracts`, and
`apps/api/src/composition.ts` becomes the only place that builds Prisma
repositories and injects them; routes and controllers receive composed
services.

---

# 26. API Boundary

**Status:** `Implemented`; response contracts `Planned (B0)`.

- Every resource route is under `/api/v1`; `/health` and `/health/ready`
  sit outside it and before the rate limiter.
- Within `/api/v1` only additive changes are allowed; a breaking change
  needs a new version (ADR-002 point 8).
- Endpoint inventory: `07-api-spec.md`.

---

# 27. DTO Boundary

**Status:** `Planned (B0)` — ADR-002; OpenAPI `Planned (B6)`.

Today controllers return domain objects and Express serializes them; the
money shape `{ amount: "100", currency: "USD" }` emerges from `Decimal`'s
`toJSON`. Target:

- Response schemas, error envelope and pagination `meta` in
  `@trading/contracts`.
- Presenters (for example `toPortfolioDto`) in `@trading/contracts`;
  controllers never serialize a domain object.
- Wire format: money `{ amount: string, currency: string }` with a decimal
  string, ISO-8601 UTC dates, ratios as numbers, identifiers as strings.
- Responses validated in API contract tests and in the demo adapter during
  development, not in production.

---

# 28. Validation Architecture

**Status:** `Implemented`; schema relocation `Planned (B0)`.

| Layer | Mechanism |
| --- | --- |
| Boundary | Zod schemas in `apps/api/src/schemas/`, applied by `validate(schema, "body" \| "query")` |
| Body parsing | Malformed or oversized JSON mapped to `VALIDATION_ERROR` |
| Domain | Entity validators (`validateNewTransaction` and others) throw `Invalid*Error` |
| Configuration | `env.ts` parses `process.env` with Zod and exits on failure |

ADR-001 point 5: request schemas move to `@trading/contracts`; the
application receives typed inputs; domain invariants stay in the domain.

---

# 29. Error Architecture

**Status:** `Implemented`; transport-free application errors `Planned (B0)`; error logging `Planned (B3)`.

Current behavior (`apps/api/src/middleware/error-handler.ts`):

| Error | Response |
| --- | --- |
| `AppError` | its `statusCode` and `code` |
| Body-parser error | 4xx `VALIDATION_ERROR` |
| Domain `Invalid*Error` / `Insufficient*Error` | 400 `VALIDATION_ERROR` |
| Anything else (including `CurrencyMismatchError`) | 500 `INTERNAL_ERROR`, no stack trace |

`AppErrorCode`: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `RATE_LIMITED`, `TIMEOUT`, `DEPENDENCY_ERROR`, `INTERNAL_ERROR`.
Envelope: `{ error: { code, message, requestId, details? } }`.

Target: the application throws `NotFoundError`, `ConflictError` and similar
(ADR-001 point 3); the API error handler maps them to HTTP and the demo to UI
states. The envelope becomes a schema in `@trading/contracts` (ADR-002). The
handler logs by category (ADR-009 point 6).

---

# 30. Transaction Boundaries

**Status:** `Implemented` for transaction creation; further boundaries `Planned` per block.

`UnitOfWork.run(work)` (domain contract) runs `work` atomically.
`PrismaUnitOfWork` uses an interactive `prisma.$transaction` and hands `work`
transaction-bound `transactions` and `positions` repositories; any error
rolls back and is rethrown unchanged.

`createTransaction` validates the input, then in one unit of work reads the
position, recalculates it with `calculatePositionAfterTransaction`, and
writes the transaction and the position together.

| Boundary | Decision | Status |
| --- | --- | --- |
| Isolation for concurrent position updates | ADR-001 Deferred detail | `Planned (B0)` |
| In-memory `UnitOfWork` with rollback, serialized | ADR-001 Deferred detail | `Planned (B0)` |
| Chronological holding check inside the unit | ADR-003 point 6 | `Planned (B0)` |
| CSV apply in one unit that also sets `COMPLETED` | ADR-008 points 2, 5 | `Planned (B4)` |
| Idempotency record written in the mutation's unit | ADR-008 Deferred detail | `Planned (B4)` |
| Alert state and notification in one transaction | ADR-007 Deferred detail | `Planned (B5)` |

---

# 31. Event-Driven Capabilities

**Status:** `Planned (B5)` for in-process realtime emission; a message broker is `Deferred`.

Events are emitted in process to the realtime transport after the
originating write commits (ADR-007 point 6). There is no broker or outbox
(ADR-008, Alternatives).

Open detail (B5): an event lost between commit and emission (crash) is not
recovered; clients converge on reconnect through the HTTP resynchronization
of ADR-007 point 5.

---

# 32. Background Processing

**Status:** `Planned (B4)` for jobs; simulator ticks, rollover and backfill `Planned (B5)`.

- Jobs (ADR-008): one use case, CSV transaction import; an in-process runner
  backed by a `jobs` table; input stored in the row; states `QUEUED`,
  `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`; validate
  stage then apply stage. Transactions stay synchronous.
- Simulator (ADR-007 point 8): runs in the API process; ticks update
  `MarketPrice` and append `MarketEvent`; at each UTC rollover it closes a
  daily candle; on startup it backfills candles for offline days.

---

# 33. Caching Strategy

**Status:** `Deferred` — no cache exists and none is decided.

---

# 34. Database Strategy

**Status:** `Implemented`; startup migrations `Planned (B7)`.

- PostgreSQL 18 via `docker-compose.yml`; Prisma 6 schema and migrations in
  `packages/database/prisma/`.
- Separate development and test databases (`.env`, `.env.test.local`).
- Migrations: `db:migrate` in development, `db:test:migrate`
  (`migrate deploy`) for tests.
- ADR-006 points 5-6: the API applies `prisma migrate deploy` on startup; the
  seed never runs automatically; rollback is forward-fix only.

Data model: `05-data-model.md`.

---

# 35. Persistence Abstraction

**Status:** `Implemented`

`client.ts` exports the shared `PrismaClient` singleton and the
`DatabaseClient` type (`PrismaClient | Prisma.TransactionClient`).
Repositories and `PrismaUnitOfWork` are the only consumers. Nothing outside
`@trading/database` imports Prisma.

---

# 36. Authentication Architecture

**Status:** `Implemented` (login, `me`, Bearer JWT); sessions `Planned (B2)`.

- Passwords hashed with `bcryptjs`; login rate-limited to 5 attempts per 15
  minutes.
- Access token: JWT, 15 minutes (`JWT_EXPIRES_IN_SECONDS`, default 900),
  Bearer header. `authenticate` verifies it and sets
  `req.auth = { userId, role }`.
- ADR-005 points 4-8: opaque refresh token stored hashed in a sessions
  table, rotated on use, sent in an `HttpOnly`, `SameSite=Strict` cookie
  scoped to `/api/v1/auth`; refresh and logout endpoints; login response
  `{ user, session: { accessToken, expiresAt } }`.

---

# 37. Authorization Architecture

**Status:** `Implemented` (ownership); permissions `Planned (B0)` and roles `Planned (B2)`.

Today services check ownership and return 404 for another user's resource,
never 403. No route checks roles.

ADR-005 points 1-3: roles `VIEWER`, `TRADER`, `ADMIN` built from an explicit
permission matrix (`09-security-spec.md`). Code checks permissions, never
role names. Enforcement lives in the application layer with an `Actor`, so
the API and the demo apply identical rules; Express middleware only
authenticates and builds the `Actor`.

---

# 38. Security Boundary

**Status:** `Implemented`; cookie CSRF header `Planned (B2)`; hardening checklist `Planned (B7)`.

`x-powered-by` disabled, `helmet`, CORS restricted to `CORS_ORIGIN`, a
general rate limit (300 requests per 15 minutes) after health routes, a
100 kB JSON body limit, and fail-fast environment validation. Refresh and
logout will require a custom request header (ADR-005 point 7). Full rules:
`09-security-spec.md`.

---

# 39. Observability Architecture

**Status:** `Implemented` (request IDs, health, readiness); logging `Planned (B3)`; metrics `Deferred`.

Today: `request-id` middleware, `/health` and `/health/ready`, and
`console.log` / `console.error` at startup.

ADR-009: a `Logger` port in `@trading/application` with a pino adapter in
the API and a console adapter in the demo; one JSON line per event with a
stable dotted `event` name; fixed redaction list; `requestId` propagated
through `AsyncLocalStorage`, `jobId` on jobs and `connectionId` on sockets;
`LOG_LEVEL`; slow-request warning (default 500 ms). Metrics are `Deferred`
(ADR-009 point 10).

---

# 40. Frontend Error Boundaries

**Status:** `Deferred` — frontend; no ADR decides it; see §7.

---

# 41. Routing Architecture

**Status:** `Deferred` — frontend; no ADR decides it; API routing is in §24-26.

---

# 42. Feature Dependency Rules

**Status:** `Implemented` for the API; frontend `Deferred`.

Within `apps/api`: routes import controllers, middleware and schemas;
controllers import services; services import `@trading/database`,
`@trading/domain` and other services (for example `transaction.service`
reuses `getPortfolioById` for ownership). Nothing imports routes or
controllers except `app.ts`.

---

# 43. Import Boundaries

**Status:** `Implemented` through workspace dependencies and TypeScript references; lint rules `Planned (B0)`.

Enforced today: a package can only import workspace packages listed in its
`package.json`, and `tsconfig.json` references build `domain` before
`database` before `api`. `eslint.config.js` has only a commented placeholder
for `no-restricted-imports`.

Rules to enforce with lint in B0 (ADR-001 point 1, ADR-002 point 1):

| Package | Must not import |
| --- | --- |
| `@trading/domain` | any other `@trading/*`, Prisma, Express, Zod, browser APIs |
| `@trading/application` | anything except `@trading/domain` |
| `@trading/contracts` | anything except `zod` and `@trading/domain` (types and enum values) |
| `@trading/market-sim` | anything except `@trading/domain` (ADR-007 point 7, B5) |

---

# 44. Dependency Direction

**Status:** `Implemented` (current graph); target graph `Planned (B0)` and `Planned (B5)`; web edge `Planned (FE)`.

Current:

```text
@trading/api --> @trading/database --> @trading/domain
@trading/api ----------------------------^
```

Target (ADR-001, ADR-002, ADR-007):

```text
@trading/api --> application, contracts, database, market-sim
application  --> domain
contracts    --> domain (types, enums), zod
database     --> domain
market-sim   --> domain
web (demo)   --> application, contracts, market-sim, in-memory repositories   [Planned (FE)]
```

The domain depends on nothing internal.

---

# 45. Configuration

**Status:** `Implemented`; `LOG_LEVEL` `Planned (B3)`; `APP_MODE` `Planned (FE)` — ADR-006 point 8.

`apps/api/src/config/env.ts` validates `NODE_ENV` (`development`, `test`,
`production`), `PORT` (default `7001`), `JWT_SECRET` (32+ characters),
`JWT_EXPIRES_IN_SECONDS` (default `900`) and `CORS_ORIGIN` (comma-separated).
`DATABASE_URL` is read by Prisma. Scripts load `.env` or `.env.test.local`
with `dotenv-cli`. Canonical names are fixed by ADR-006 point 8.

---

# 46. Feature Flags

**Status:** `Deferred` — none exist and none are decided.

---

# 47. Demo Mode Boundary

**Status:** `Planned (FE)` — ADR-001 point 4, ADR-005 point 11, ADR-006 point 7.

The demo replaces only repositories and adapters. It runs the same
permission checks with a demo identity and role selector, calls no backend
and ships no secrets.

---

# 48. Demo Simulation Engine

**Status:** `Planned (B5)` — ADR-007 point 7.

`@trading/market-sim` is one engine for the API and the demo, with the modes
and scenarios of `12-demo-mode-spec.md` §37-40.

---

# 49. Simulation Determinism

**Status:** `Planned (B5)` — ADR-007 points 7-8.

Seeded pseudo-random generator and injected clock. In real mode the engine
initializes from persisted `MarketPrice` and the highest `MarketEvent`
sequence per asset (ADR-007 Deferred detail).

---

# 50. Data Flow Example — Transaction

**Status:** `Implemented`; idempotency `Planned (B4)`; chronological check `Planned (B0)`; event `Planned (B5)`.

```text
POST /api/v1/portfolios/:portfolioId/transactions
  -> authenticate -> validate(createTransactionRequestSchema)
  -> createTransactionHandler -> createTransaction
       ownership (getPortfolioById), asset lookup, validateNewTransaction
       UnitOfWork: read position -> calculatePositionAfterTransaction -> write transaction + position
  -> 201 with the created transaction
```

Additions: `Idempotency-Key` (ADR-008 point 8), chronological validation
(ADR-003 point 6), `PORTFOLIO_UPDATED` after commit (ADR-007 point 6).

---

# 51. Data Flow Example — Real-Time Price

**Status:** `Planned (B5)` — ADR-007.

```text
simulator tick -> update MarketPrice + append MarketEvent
               -> emit MARKET_PRICE_UPDATED on market:{assetId}
               -> evaluate alerts (edge-triggered) -> notification + ALERT_TRIGGERED + NOTIFICATION_CREATED
client         -> recompute valuations from the new price
```

---

# 52. Data Flow Example — Scenario

**Status:** `Implemented`

`calculateScenario` and `compareScenarios` in
`apps/api/src/services/scenario.service.ts` load holdings and the scenario,
then call the pure `calculateScenarioImpact` and `compareScenarioImpacts`.
Nothing is persisted by a calculation.

---

# 53. Data Flow Example — Decision Replay

**Status:** `Implemented`

`getDecisionReplay` (`apps/api/src/services/decision.service.ts`) resolves
ownership through decision, portfolio and user, then returns the ordered
events, the asset currency and `initialState`. The client folds events with
the same pure `projectDecisionReplay` from `@trading/domain`, so the demo
behaves identically.

```text
decision -> ordered DecisionEvents -> projectDecisionReplay(events, index) -> replay state -> UI
```

Replay is a projection of history; it never mutates stored records.

---

# 54. Performance Architecture

**Status:** `Implemented` (pagination); slow-request logging `Planned (B3)`; frontend `Deferred`.

List endpoints paginate through `PageRequest` and `Page<T>`. ADR-009 point 8
adds a slow-request warning and separate timing of the analytics series
(ADR-004). Targets: `03-non-functional-requirements.md`.

---

# 55. Rendering Strategy

**Status:** `Deferred` — frontend; no ADR decides it.

---

# 56. Chart Architecture

**Status:** `Deferred` — frontend; no ADR decides it.

---

# 57. Scalability Path

**Status:** `Deferred`

A single local process is the decided model (ADR-006). Hosting the backend,
horizontal scaling or separate workers require a new ADR.

---

# 58. Deployment Architecture

**Status:** `Implemented` (local development); production build and containers `Planned (B7)`; demo hosting `Planned (FE)` — ADR-006 points 1, 7.

Today: `docker-compose.yml` runs PostgreSQL only; the API runs with
`tsx watch`. The production build does not run: `@trading/domain`,
`@trading/database` and `@trading/api` point `main` at `./src/index.ts`.

ADR-006 points 3-4: every package compiles to `dist` and exposes it through
`exports`; the API runs `node dist/index.js`; a multi-stage, non-root API
Dockerfile; a Compose `full` profile with PostgreSQL and the API. Details:
`14-deployment-spec.md`.

---

# 59. Cost-Aware Architecture

**Status:** `Implemented`

No hosted backend, database or paid market data. The public demo is a
static build with no running cost (ADR-006).

---

# 60. Testing Architecture

**Status:** `Implemented`; application unit tests `Planned (B0)`; CI `Planned (B0)`.

| Package | Tests |
| --- | --- |
| `@trading/domain` | Vitest unit tests, no database |
| `@trading/database` | Vitest against the test database |
| `@trading/api` | Vitest + supertest on `createApp()` against the test database |

Planned: application services unit-tested with in-memory fakes (ADR-001
point 7); response contract tests (ADR-002 point 6); one GitHub Actions
workflow running install, typecheck, lint and the three suites with a
PostgreSQL service, landing before B0 (ADR-006 point 10). Strategy:
`10-testing-strategy.md`.

---

# 61. Architectural Trade-Offs

**Status:** `Implemented`

| Choice | Over | Source |
| --- | --- | --- |
| Modular monolith in one process | Microservices | §3.5, ADR-006 |
| Shared application package injected per runtime | Mocking at the HTTP client | ADR-001 |
| Factory functions per resource | Use-case classes or a command bus | ADR-001 |
| Declared DTOs and presenters | Serializing domain objects | ADR-002 |
| REST plus WebSocket with a small event catalog | Event-first or pushed valuations | ADR-007 |
| In-process job runner on PostgreSQL | External queue and worker | ADR-008 |
| Structured logs only | Metrics stack | ADR-009 |

---

# 62. Architectural Anti-Patterns

**Status:** `Implemented` as rules; current violations listed with their fix block.

- Instantiating infrastructure inside use cases — present in
  `apps/api/src/services/`, removed in B0.
- Transport concepts in application logic (`AppError` status codes) —
  removed in B0.
- Serializing domain objects as API responses — removed in B0 (ADR-002).
- Importing Prisma outside `@trading/database`.
- Money as a JavaScript number anywhere on the wire or in calculations.
- Checking role names instead of permissions (ADR-005).

---

# 63. Architecture Decision Records

**Status:** `Implemented`

Decisions live in `docs/adr/` (index: `docs/adr/README.md`) and take
precedence over this document. This document reflects ADR-001, ADR-002,
ADR-005, ADR-006, ADR-007, ADR-008 and ADR-009; ADR-003 and ADR-004 shape
§30 and §10.

---

# 64. Architecture Quality Gates

**Status:** `Implemented` locally; CI `Planned (B0)`.

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`, and a Husky
pre-commit hook running `lint-staged` (ESLint and Prettier). Lint import
boundaries are added in B0 (§43); CI runs the gates on every push and pull
request (ADR-006 point 10).

---

# 65. Architectural Success Definition

**Status:** `Planned (B0)`

The architecture matches this document when `@trading/application` and
`@trading/contracts` exist, `apps/api` only composes and transports, every
service runs against in-memory repositories in tests, and the lint rules of
§43 pass.

---

# 66. Final Architectural Principle

**Status:** `Implemented`

Business behavior is written once, in packages that know nothing about how
they are delivered; each runtime only composes and transports it.

---

# 67. Failure-Mode Review

**Status:** `Implemented` (review of the decided architecture, 2026-10-05)

Architecture-level application of the checklist in `docs/README.md`. Each
row points to an existing decision; nothing here adds one.

| Category | Architecture concern | Decision | Block |
| --- | --- | --- | --- |
| Concurrency | Two `SELL`s race on one position | `UnitOfWork` isolation (ADR-001 Deferred detail) | B0 |
| Concurrency | Interleaved in-memory units | Serialized in-memory `UnitOfWork` (ADR-001 Deferred detail) | B0 |
| Concurrency | Same `Idempotency-Key` in flight; racing job transitions | Key reservation; compare-and-set transitions (ADR-008 Deferred detail) | B4 |
| Crash and restart | Job dies mid-run | Apply commits with `COMPLETED`; `PROCESSING` becomes `FAILED`/`INTERRUPTED`; `QUEUED` resumes (ADR-008 point 5) | B4 |
| Crash and restart | Simulator and sequences after restart | Init from persisted state, candle backfill, per-process epoch (ADR-007 point 8, Deferred detail) | B5 |
| Crash and restart | Alert state lost | Persisted with the notification (ADR-007 Deferred detail) | B5 |
| Timeouts and expiry | Socket outlives token | Socket bound to token expiry, 5 s auth window (ADR-007 point 2) | B5 |
| Timeouts and expiry | Job exceeds limit | Timeout per attempt, apply exempt (ADR-008 point 7) | B4 |
| Timeouts and expiry | Session length | 15-minute access token, rotating refresh (ADR-005) | B2 |
| Retries and duplicates | Retried `POST` | `Idempotency-Key`, 24 h, stored in the mutation's unit (ADR-008 point 8) | B4 |
| Retries and duplicates | Missed realtime events | Sequence gap triggers HTTP resync (ADR-007 point 5) | B5 |
| Retries and duplicates | Alert repeats every tick | Edge-triggered alerts (ADR-007 point 9) | B5 |
| Boundary math and data edges | Decimal precision on the wire | Decimal strings in fixed notation (ADR-002, Deferred detail) | B0 |
| Boundary math and data edges | Mixed currencies return 500 | Asset currency must match the portfolio base currency (ADR-004, ADR-008 point 10) | B1, B4 |
| Boundary math and data edges | Daily boundaries | UTC rollover closes candles (ADR-007 point 8) | B5 |
| Partial failure | Transaction plus position write | One `UnitOfWork` | Implemented |
| Partial failure | CSV import | Validate all, then apply in one unit (ADR-008 point 2) | B4 |
| Partial failure | Commit succeeds, event emission fails | Open detail in §31 | B5 |
