# SDD 04 — Technology Stack

**Project:** Trading Analytics Platform  
**Status:** Reconciled with the package manifests, `pnpm-lock.yaml` and ADR-001 to ADR-009 on 2026-10-05  
**Version:** 2.0  
**Purpose:** Record the technologies the repository uses, the ones an ADR has decided, and the rules for adding new ones.  
**Decisions:** ADR-001 (`adr/0001-application-layer.md`), ADR-002 (`adr/0002-shared-contracts.md`), ADR-005 (`adr/0005-roles-and-authentication.md`), ADR-006 (`adr/0006-deployment-model-and-ci.md`), ADR-007 (`adr/0007-realtime-and-market-simulation.md`), ADR-008 (`adr/0008-background-jobs-csv-import.md`), ADR-009 (`adr/0009-observability-scope.md`)

---

# 1. Technology Strategy

**Status:** `Implemented`

Every technology has one identifiable responsibility. Choices favor strong
TypeScript support, testability, low operational complexity and zero
recurring cost. No technology is added to make the architecture look more
complex.

Statuses follow `docs/README.md`: `Implemented` (in code on `develop`),
`Planned (B#)` or `Planned (FE)` (decided by an ADR, not yet in code),
`Deferred` (no decision). Versions are the ones resolved in
`pnpm-lock.yaml`; planned items carry no version until they are installed.

Section numbers are stable because code and other documents cite them
(§21, §24, §28.1, §41, §47-48). The full inventory is in §53.

---

# 2. Version Policy

**Status:** `Implemented`

- `package.json` files declare caret ranges; `pnpm-lock.yaml`
  (`lockfileVersion: '9.0'`) pins the exact resolved versions. Installs use
  the lockfile.
- A dependency is installed at its latest stable version when it is added,
  and upgraded deliberately, with the tests passing.
- A version that cannot be the latest because of compatibility is recorded
  here with its reason.

Open detail (B0): the workspace resolves two TypeScript lines (`6.0.3` in
the root and `apps/api`, `5.9.3` in `packages/domain` and
`packages/database`) and two `@types/node` lines (`22.20.2` in `apps/api`,
`26.4.1` elsewhere) against `engines.node >=22.0.0`. Aligning them, or
recording why they differ, belongs to the B0 package work.

---

# 3. Language Strategy

**Status:** `Implemented` for the backend and packages; frontend `Planned (FE)` — ADR-002 point 5.

TypeScript is the only application language. JavaScript appears only in
tooling configuration (`eslint.config.js`) and repository scripts
(`scripts/check-docs.mjs`). All workspaces are ES modules (`"type": "module"`).

---

# 4. Frontend Stack

## 4.1 React

**Status:** `Deferred` — no ADR decides the frontend rendering library (`06-architecture.md` §7).

`apps/web` holds only `wireframe.html` and `WIREFRAME-PLAN.md`. The frontend
library is chosen in the frontend stage.

---

# 5. Frontend Build Tool

**Status:** `Planned (FE)` — ADR-006 points 1, 7 and 8.

The public demo is a static build of `apps/web`, served under a configurable
base path, and the web build reads `VITE_APP_MODE` (ADR-006 point 8). Vite is
therefore the build tool.

---

# 6. TypeScript

**Status:** `Implemented`

`tsconfig.base.json` sets `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `isolatedModules`,
`target`/`lib` `ES2022` and `moduleResolution: "Bundler"`. The root
`tsconfig.json` builds `packages/domain`, `packages/database` and `apps/api`
as project references (`pnpm typecheck` runs `tsc --build`). ESLint forbids
explicit `any` (§34). Resolved versions: see §2.

---

# 7. Styling

**Status:** `Deferred` — no ADR decides it.

---

# 8. UI Components

**Status:** `Deferred` — no ADR decides it.

---

# 9. Animation

**Status:** `Deferred` — no ADR decides the library. Respecting
`prefers-reduced-motion` is an accessibility requirement
(`03-non-functional-requirements.md`), not a library choice.

---

# 10. Server State

**Status:** `Deferred` — no ADR decides it (`06-architecture.md` §17).

Decided constraint: the UI reads DTOs only through the `TradingClient` port
(ADR-002 point 5), whatever caching library is chosen.

---

# 11. Client State

**Status:** `Deferred` — no ADR decides it (`06-architecture.md` §17).

Decided constraint: the access token lives in memory only (ADR-005 point 4).

---

# 12. Tables

**Status:** `Deferred` — no ADR decides it.

---

# 13. Forms

**Status:** `Deferred` — no ADR decides it.

---

# 14. Validation

**Status:** `Implemented` in `apps/api`; shared schemas `Planned (B0)` — ADR-002.

- `zod` `4.6.5` validates request bodies, params and queries
  (`apps/api/src/schemas/`) and the environment at startup
  (`apps/api/src/config/env.ts`, §42).
- Request and response schemas move to `@trading/contracts` in B0
  (ADR-002 points 1-2).
- The realtime envelope is a Zod schema in `@trading/contracts`
  (`Planned (B5)`, ADR-007 point 4).
- Responses are validated in contract tests, not at runtime in production
  (ADR-002 point 6).

---

# 15. API Contract Types

**Status:** `Planned (B0)` — ADR-002.

DTO types are inferred from the Zod schemas in `@trading/contracts`;
presenters map domain objects to DTOs. Today only request types exist, in
`apps/api`.

---

# 16. Charts and Data Visualization

**Status:** `Deferred` — no ADR decides the chart library. Any choice must be
free to use and need no paid API (§49).

---

# 17. Backend Runtime

**Status:** `Implemented`

Node.js, `engines.node >=22.0.0`. The API runs in development with `tsx`
`4.23.13` (`tsx watch`) and is started with `node dist/index.js`. Background
jobs run in the API process (`Planned (B4)`, ADR-008 point 4); the realtime
server runs in it too (`Planned (B5)`, ADR-007).

Open detail (B7): the production build path is fixed in B7 (ADR-006 point 3).

---

# 18. Backend Language

**Status:** `Implemented`

The backend and every package are TypeScript under the strict settings of §6.

---

# 19. Backend Framework

**Status:** `Implemented`; business logic leaves the services for `@trading/application` in `Planned (B0)` — ADR-001.

| Package | Version | Role |
| --- | --- | --- |
| `express` | 5.2.1 | HTTP routing and middleware |
| `helmet` | 8.3.0 | Security headers |
| `cors` | 2.8.6 | CORS, origins from `CORS_ORIGIN` |
| `express-rate-limit` | 7.5.1 | General and login rate limits |

---

# 20. API Architecture

**Status:** `Implemented` (routes → controllers → services → repositories); application package `Planned (B0)` — ADR-001.

REST under `/api/v1`; health endpoints at `/health` and `/health/ready`.
Layers and dependency rules are specified in `06-architecture.md` §24-29;
endpoints in `07-api-spec.md`.

---

# 21. API Documentation

**Status:** `Planned (B6)` — ADR-002 point 7.

## OpenAPI

The OpenAPI document is generated from the `@trading/contracts` Zod schemas
with Zod v4's `toJSONSchema`. There is no hand-maintained API document. It
covers endpoints, parameters, bodies, responses, the error envelope,
authentication and examples.

Open detail (B6): whether and how the generated document is served.

---

# 22. Realtime

**Status:** `Planned (B5)` — ADR-007 point 1.

## WebSockets

WebSocket transport with the `ws` library, behind a transport port so no
other code imports it. Authentication, channels, envelope and limits are in
ADR-007 and `08-realtime-spec.md`.

---

# 23. Authentication

**Status:** `Implemented` (login, `GET /auth/me`, Bearer JWT); sessions and refresh `Planned (B2)` — ADR-005 points 4-8.

- `jsonwebtoken` `9.0.3` signs access tokens with `JWT_SECRET` (32+
  characters); lifetime `JWT_EXPIRES_IN_SECONDS`, default `900` (15 minutes).
- B2 adds an opaque, hashed, rotating refresh token in an `HttpOnly`,
  `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`.
- Secrets are never committed (§43).

---

# 24. Authorization

**Status:** `Implemented` (ownership checks; another user's resource returns 404); permission checks `Planned (B0)`; roles `Planned (B2)` — ADR-005.

- Roles are `VIEWER`, `TRADER` and `ADMIN`. The schema's current `USER` role
  migrates to `TRADER`; `ANALYST` is dropped (ADR-005 point 1).
- Code checks permissions, never role names. The matrix lives in
  `09-security-spec.md` (ADR-005 point 2).
- Checks run server-side in the application layer, on an `Actor`
  (ADR-005 point 3). Frontend checks only shape the UI.

---

# 25. Authentication Library Policy

**Status:** `Implemented`

No authentication framework or external identity provider is used. ADR-005
defines the session model directly. Adding OAuth, SSO or social login needs
a new ADR.

---

# 26. Password Security

**Status:** `Implemented` — ADR-005 point 12.

`bcryptjs` `3.0.3` (pure JavaScript, no native build). Seed and test hashes
use 10 rounds. Registration is out of scope (ADR-005 point 10).

---

# 27. Database

**Status:** `Implemented`

## PostgreSQL

PostgreSQL 18 (`postgres:18` image in `docker-compose.yml`). It runs only
locally: there is no hosted database (ADR-006 point 2).

---

# 28. ORM / Database Access

**Status:** `Implemented`

## Prisma

`prisma` and `@prisma/client` `6.19.3` in `packages/database`. The schema is
`packages/database/prisma/schema.prisma` (`prisma-client-js` generator,
output `packages/database/generated/client`). Migrations use
`prisma migrate dev` in development and `prisma migrate deploy` for tests;
startup migrations are `Planned (B7)` (ADR-006 point 5). The seed runs only
on demand (`pnpm --filter @trading/database db:seed`).

Domain code never imports Prisma; repositories isolate it (§29).

---

# 28.1 Decimal Precision

**Status:** `Implemented` for money in the domain; analytics in `Decimal` end to end `Planned (B1)` — ADR-004; JSON payload parsing `Planned (B0)` — ADR-002 point 9.

## decimal.js

`decimal.js` `10.6.0` (in `packages/domain`) is the library for
arbitrary-precision decimal arithmetic across the monorepo.

### Reason

- `05-data-model.md` §39 requires money to avoid floating-point arithmetic.
- Prisma's `Decimal` is built on `decimal.js`, so domain and persistence use
  one representation.
- Free, maintained, ships its own types.

### Usage

- Money is a `Money` value object (amount plus currency) backed by
  `decimal.js`. Persisted money and quantities are `Decimal(18, 8)`.
- On the wire, money is `{ amount: string, currency: string }` (ADR-002
  point 3). Money and quantities inside JSON columns are decimal strings
  parsed with `Decimal` (ADR-002 point 9).
- Analytics returns are computed in `Decimal`; numbers appear only in the
  presenter (ADR-004, `16-analytics-spec.md`).
- It is not used for identifiers, counts or display-only values.

Open detail (B1): domain entities hold `quantity` as a JavaScript `number`
(see the comments in `packages/domain/src/entities/`), while ADR-004 computes
`quantity × close` in `Decimal`. B1 fixes where quantities convert to
`Decimal`.

---

# 29. Database Architecture

**Status:** `Implemented`

```text
Service → Repository interface (@trading/domain) → Prisma repository (@trading/database) → PostgreSQL
```

Multi-step writes go through a `UnitOfWork` (`06-architecture.md` §30).

---

# 30. Mock Infrastructure

**Status:** in-memory repositories `Planned (B0)` — ADR-001 points 4 and 7; demo composition `Planned (FE)` — ADR-001 point 4.

The demo needs no PostgreSQL. It composes `@trading/application` with
in-memory implementations of the same repository and `UnitOfWork`
contracts. Demo data layers and reset are `Deferred` (`06-architecture.md`
§14).

---

# 31. Mock API / Network Simulation

**Status:** `Deferred` — superseded by ADR-001 and ADR-002 (`06-architecture.md` §15).

The demo calls the application layer in process through the `TradingClient`
in-process adapter (ADR-002 point 5). No network-level mock (such as Mock
Service Worker) is part of the design.

---

# 32. Simulation Engine

**Status:** `Planned (B5)` — ADR-007 point 7.

`@trading/market-sim`: a pure, deterministic engine with a seeded
pseudo-random generator and an injected clock, depending only on
`@trading/domain`. The API and the demo use the same engine.

Open detail (B5): the package path (`06-architecture.md` §48).

---

# 33. Testing Stack

**Status:** `Implemented` for unit and API integration tests; component and end-to-end tooling `Deferred`.

## Vitest

`vitest` `3.2.7` in `packages/domain`, `packages/database` and `apps/api`.
Database and API suites run against a test PostgreSQL database loaded from
`.env.test.local` (`dotenv-cli` `11.0.0`).

## Supertest

`supertest` `7.2.2` drives the Express app in `apps/api` integration tests.

## Component and end-to-end tests

No ADR decides the component-testing library or the end-to-end runner.
Test levels and scope are in `10-testing-strategy.md`.

---

# 34. Code Quality

**Status:** `Implemented`; architectural import rules `Planned (B0)` — ADR-001 point 1.

## ESLint

`eslint` `10.10.0` with a flat config (`eslint.config.js`): `@eslint/js`
`10.0.1` recommended, `typescript-eslint` `8.69.0` `strictTypeChecked` and
`stylisticTypeChecked` with the project service, `no-explicit-any`,
`consistent-type-imports`, and `eslint-config-prettier` `10.1.8` last.
Config files and `scripts/*.mjs` run without type-aware rules.

---

# 35. Formatting

**Status:** `Implemented`

`prettier` `3.9.6` (`.prettierrc.json`: double quotes, semicolons,
trailing commas, width 100, LF). `husky` `9.1.7` runs `lint-staged`
`17.5.0` on pre-commit: ESLint `--fix` and Prettier on staged
TypeScript/JavaScript, Prettier on JSON, Markdown and YAML.

---

# 36. Architecture Enforcement

**Status:** workspace dependencies and TypeScript project references `Implemented`; lint rules `Planned (B0)` — ADR-001 point 1.

`@trading/domain` and `@trading/application` must not import Prisma,
Express, transport Zod schemas or browser APIs. The rules are listed in
`06-architecture.md` §43.

---

# 37. Package Manager

**Status:** `Implemented`

pnpm workspaces (`apps/*`, `packages/*`). `packageManager` is
`pnpm@12.3.4`; `engines.pnpm` is `>=9.0.0`. `pnpm-workspace.yaml`
`allowBuilds` permits install scripts only for Prisma and `esbuild`.

---

# 38. Repository Structure

**Status:** `Implemented` for the current tree; new packages `Planned (B0)` and `Planned (B5)`.

```text
apps/
  api/            Express API (@trading/api)
  web/            wireframe only; web app Planned (FE)
packages/
  domain/         @trading/domain
  database/       @trading/database (Prisma)
  contracts/      empty; @trading/contracts Planned (B0), ADR-002
  config/         empty; no decision
docker/           empty (.gitkeep)
docs/             SDD, ADRs, roadmap
scripts/          check-docs.mjs
```

`@trading/application` (ADR-001) and `@trading/market-sim` (ADR-007) are
added in B0 and B5. The authoritative package map is `06-architecture.md` §4.

---

# 39. Monorepo Strategy

**Status:** `Implemented`; `@trading/config` `Deferred` — no ADR decides it.

Only genuinely shared code becomes a package. Workspace packages are linked
with `workspace:*`.

---

# 40. Docker

**Status:** PostgreSQL service `Implemented`; API image and `full` profile `Planned (B7)` — ADR-006 point 4.

`docker-compose.yml` runs PostgreSQL 18 with a named volume and a
`pg_isready` health check; credentials and port come from `DATABASE_*`
variables with development defaults. B7 adds a multi-stage, non-root API
Dockerfile and a `full` profile (PostgreSQL and API); the default profile
keeps only PostgreSQL. The frontend is not containerized.

---

# 41. CI/CD

**Status:** `Planned (B0)` — ADR-006 point 10. No continuous deployment.

## GitHub Actions

One workflow on pushes and pull requests to `develop` and `main`:

```text
Install (frozen lockfile) → Typecheck → Lint → Domain, database and API tests
```

The database and API suites run against a PostgreSQL service container.
Today `.github/` holds only `PULL_REQUEST_TEMPLATE.md`.

Open detail (B0): adding `pnpm docs:check` and `pnpm format:check` to the
workflow.

---

# 42. Environment Configuration

**Status:** `Implemented`; `LOG_LEVEL` `Planned (B3)` — ADR-009 point 7; `SLOW_REQUEST_THRESHOLD_MS` `Planned (B3)` — ADR-009 point 8; `APP_MODE` `Planned (FE)` — ADR-006 point 8.

| Variable | Read by | Rule |
| --- | --- | --- |
| `NODE_ENV` | API | `development`, `test` or `production`; default `development` |
| `PORT` | API | positive integer; default `7001` |
| `JWT_SECRET` | API | required, at least 32 characters |
| `JWT_EXPIRES_IN_SECONDS` | API | positive integer; default `900` |
| `CORS_ORIGIN` | API | comma-separated origins; default `http://localhost:5173` |
| `DATABASE_URL` | Prisma | PostgreSQL connection string |
| `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_PORT` | Docker Compose | development defaults |
| `LOG_LEVEL` | API (B3) | `debug` in development, `info` in production, `silent` in tests |
| `SLOW_REQUEST_THRESHOLD_MS` | API (B3) | milliseconds; default `500`; HTTP requests only |
| `APP_MODE` | web build (FE) | `real` or `demo`, exposed as `VITE_APP_MODE` |

The API validates its variables with Zod at startup and exits with code 1
on any invalid value, naming the keys but never their values. Scripts load
`.env` or `.env.test.local` through `dotenv-cli`.

Open detail (FE): the web build's API and WebSocket base URLs.

---

# 43. Secrets

**Status:** `Implemented` for the API; log redaction `Planned (B3)` — ADR-009 point 4; demo build `Planned (FE)` — ADR-006 point 7.

- Secrets live only in environment variables; `.env`, `.env.local` and
  `.env.*.local` are git-ignored.
- B3 redacts passwords, the `Authorization` header, cookies, and access and
  refresh tokens from logs.
- The demo build contains no secrets and calls no backend.

---

# 44. Logging

**Status:** `Planned (B3)` — ADR-009.

`pino` for one JSON line per event on stdout, `pino-http` for request logs,
`pino-pretty` in development only, behind a `Logger` port in
`@trading/application`. The format follows the environment (JSON on stdout;
`pino-pretty` only in development), and `LOG_LEVEL` is the only logging
variable. Fields: `timestamp`, `level`, `service`, `environment`, `event`,
`message`, `requestId`, `userId`, `durationMs`, `errorCategory` (the
`AppErrorCode` value). No log files. Today the API writes plain `console`
output at startup, on invalid configuration and in the error handler.

---

# 45. Observability

**Status:** request IDs and health endpoints `Implemented`; logging `Planned (B3)` — ADR-009; metrics `Deferred` — ADR-009 point 10.

Request IDs come from `request-id` middleware; `/health` is liveness and
`/health/ready` checks the database, and from B3 it answers 503 while the
API shuts down (ADR-006 point 12). No paid observability platform is used.
Details are in `13-observability-spec.md`.

---

# 46. Hosting Requirements

**Status:** local full stack `Implemented`; public demo hosting `Planned (FE)` — ADR-006 points 1 and 7; public backend `Deferred` — ADR-006 point 2.

Exactly two targets: the local production-like full stack and a static
public demo. Nothing requires a paid service.

---

# 47. External Financial APIs

**Status:** `Implemented` (none used); simulator price source `Planned (B5)` — ADR-007; external provider `Deferred`.

The application depends on no financial data API. In both real and demo
mode prices come from the simulator; seed data is `MOCK`.

---

# 48. External Service Abstraction

**Status:** `Implemented` as a rule; no external service exists.

Any future external provider sits behind a port with an adapter, and no
vendor SDK is imported into domain or application code. The realtime
transport follows the same rule (ADR-007 point 1).

---

# 49. Free-Tier Constraint

**Status:** `Implemented` for the local full stack; public demo `Planned (FE)`.

```text
Public demo: static hosting + in-process application + browser simulation = $0
Local full stack: Node API + PostgreSQL (Docker) = $0
```

No decision may assume a paid plan.

---

# 50. Browser-Only Demo

**Status:** `Planned (FE)` — ADR-001 point 4, ADR-002 point 5, ADR-006 point 7, ADR-007 point 13.

The demo runs entirely in the browser: `@trading/application` with
in-memory repositories, the `TradingClient` in-process adapter, and
`@trading/market-sim` feeding an in-process realtime adapter. It calls no
backend.

---

# 51. Technology Selection Rules

**Status:** `Implemented`

Before adding a dependency, check that the current stack does not already
solve the problem, that it reduces complexity, is maintained,
TypeScript-friendly and free, and creates no lock-in. A dependency that
settles an open architectural question needs an ADR first; a dependency an
ADR already names is added in that ADR's block.

---

# 52. Prohibited Architectural Shortcuts

**Status:** `Implemented` as rules

- Business logic in UI components or Express controllers.
- Prisma imported outside `@trading/database`.
- Bypassing the API contracts or serializing domain objects directly
  (ADR-002 point 4).
- Financial calculations inside charts or presenters.
- Paid APIs for required functionality.
- Microservices, external queues or brokers without a concrete requirement
  (ADR-008 point 4).
- An authentication framework without a demonstrated need (§25).

---

# 53. Approved Core Stack

**Status:** inventory of the stack; each row carries its own status.

| Area | Technology | Version | Status | Source |
| --- | --- | --- | --- | --- |
| Language | TypeScript | 6.0.3 / 5.9.3 | `Implemented` | §2, §6 |
| Runtime | Node.js | `>=22.0.0` | `Implemented` | §17 |
| Dev runner | tsx | 4.23.13 | `Implemented` | §17 |
| HTTP | Express | 5.2.1 | `Implemented` | §19 |
| HTTP | helmet, cors, express-rate-limit | 8.3.0, 2.8.6, 7.5.1 | `Implemented` | §19 |
| Validation | Zod | 4.6.5 | `Implemented` | §14 |
| Auth | jsonwebtoken | 9.0.3 | `Implemented` | §23 |
| Auth | bcryptjs | 3.0.3 | `Implemented` | §26 |
| Data | PostgreSQL | 18 | `Implemented` | §27 |
| Data | Prisma | 6.19.3 | `Implemented` | §28 |
| Precision | decimal.js | 10.6.0 | `Implemented` | §28.1 |
| Testing | Vitest | 3.2.7 | `Implemented` | §33 |
| Testing | Supertest | 7.2.2 | `Implemented` | §33 |
| Quality | ESLint, typescript-eslint | 10.10.0, 8.69.0 | `Implemented` | §34 |
| Quality | Prettier | 3.9.6 | `Implemented` | §35 |
| Quality | husky, lint-staged | 9.1.7, 17.5.0 | `Implemented` | §35 |
| Tooling | pnpm | 12.3.4 | `Implemented` | §37 |
| Tooling | dotenv-cli | 11.0.0 | `Implemented` | §42 |
| Infrastructure | Docker Compose (PostgreSQL) | — | `Implemented` | §40 |
| Contracts | `@trading/contracts` (Zod) | — | `Planned (B0)` | ADR-002 |
| CI | GitHub Actions | — | `Planned (B0)` | ADR-006 point 10 |
| Logging | pino, pino-http, pino-pretty | — | `Planned (B3)` | ADR-009 point 2 |
| Realtime | ws | — | `Planned (B5)` | ADR-007 point 1 |
| Simulation | `@trading/market-sim` | — | `Planned (B5)` | ADR-007 point 7 |
| API docs | OpenAPI from Zod `toJSONSchema` | — | `Planned (B6)` | ADR-002 point 7 |
| Infrastructure | API Dockerfile, `full` profile | — | `Planned (B7)` | ADR-006 point 4 |
| Frontend build | Vite | — | `Planned (FE)` | ADR-006 point 8 |
| Frontend | UI library, styling, components, animation, server and client state, tables, forms, charts | — | `Deferred` | §4, §7-13, §16 |
| Testing | Component and end-to-end tooling | — | `Deferred` | §33 |
| Observability | Metrics | — | `Deferred` | ADR-009 point 10 |

Type-only packages (`@types/*`) follow their runtime packages and are not
listed.

---

# 54. Technology Decision Principle

**Status:** `Implemented`

Deliberate choices, not quantity. Real and demo infrastructure are
interchangeable behind the same application contracts (ADR-001), so the
technology under a port can change without changing product behavior.

---

# 55. Stack Acceptance Criteria

**Status:** criteria for the backend foundation `Implemented`; the rest follow the blocks named.

- Backend and packages use strict TypeScript. `Implemented`
- Express on Node provides the API; Zod validates its inputs. `Implemented`
- PostgreSQL with Prisma behind repositories provides persistence. `Implemented`
- Money uses `decimal.js`. `Implemented`
- Vitest covers domain, database and API. `Implemented`
- Shared contracts and lint-enforced boundaries. `Planned (B0)`
- CI runs without paid services. `Planned (B0)`
- Sessions with refresh tokens and permission-based roles. `Planned (B0)`, `Planned (B2)`
- Structured logging. `Planned (B3)`
- WebSocket realtime with the shared simulator. `Planned (B5)`
- Generated OpenAPI. `Planned (B6)`
- Containerized production-like local run. `Planned (B7)`
- The public demo runs entirely on in-process infrastructure. `Planned (FE)`
- No required paid API exists. `Implemented`

---

# 56. Failure-Mode Review

**Status:** `Implemented` (review of this document, 2026-10-05)

Only the categories that apply to tooling, runtime versions and
configuration are listed.

| Category | Finding | Resolution |
| --- | --- | --- |
| Boundary math and data edges | Two TypeScript and two `@types/node` lines resolve in one workspace. | Open detail (B0), §2. |
| Boundary math and data edges | Domain quantities are `number` while analytics need `Decimal`. | Open detail (B1), §28.1. |
| Partial failure | Invalid or missing configuration. | API exits at startup with the invalid keys (§42). `Implemented` |
| Crash and restart | API starting before PostgreSQL accepts connections in the `full` profile. | `depends_on` with `service_healthy` (ADR-006 Deferred detail, B7). |
| Retries and duplicates | Non-reproducible installs. | Lockfile installs locally and in CI (§2, §41). |
