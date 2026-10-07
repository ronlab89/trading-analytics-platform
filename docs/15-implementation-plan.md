# SDD 15 — Implementation Plan

**Project:** Trading Analytics Platform  
**Document:** Implementation Plan  
**Version:** 1.0  
**Status:** Backend-first override added and §1-4 reconciled with the ADRs and the code on 2026-10-07 (§4.1-4.3); §5-end are reconciled in later slices  
**Previous document:** `14-deployment-spec.md`

---

## 1. Purpose

**Status:** `Reference`; the build order stated in this document is overridden by §4.1.

This document translates the complete Software Design Document set into an executable implementation roadmap.

The objective is to build the Trading Analytics Platform incrementally while preserving product coherence, architectural boundaries, security, testability, realtime behavior, Demo Mode, observability, deployment reproducibility, and technical interview readiness.

Implementation should proceed in vertical slices where practical rather than building the entire frontend, backend, and infrastructure independently and integrating them at the end.

Code vs ADR: development is backend-first, not full-stack vertical slices from the start. The backend is completed in blocks B0-B7 before the frontend stage begins (`00-overview.md` §1, §4.1). Vertical slicing applies inside each backend block and inside each frontend block, not across the two stages.

---

## 2. Implementation Philosophy

**Status:** `Reference`

> **Build the smallest complete system that proves each architectural decision before increasing scope.**

The project should optimize for demonstrating:

```text
Product Thinking
      ↓
UX/UI
      ↓
Architecture
      ↓
Implementation
      ↓
Testing
      ↓
Observability
      ↓
Deployment
```

Do not add technologies merely to increase the apparent size of the stack.

---

## 3. Implementation Rules

**Status:** `Reference`

1. Do not optimize based on assumptions; measure first.
2. Do not invent performance, business, or user metrics.
3. Keep domain rules outside presentation code.
4. Use explicit typed contracts at important boundaries.
5. Keep infrastructure replaceable through adapters.
6. Treat Demo Mode as part of the architecture.
7. Design failure states alongside happy paths.
8. Prefer simple infrastructure until complexity is justified.
9. Update the SDDs when implementation intentionally diverges from them.
10. Keep the repository reproducible from a clean environment.

---

## 4. Phase Overview

**Status:** per item (§4.2); the order below is the original plan and is overridden by §4.1

```text
Phase 0  → Repository foundation
Phase 1  → Product/domain foundation
Phase 2  → Database and infrastructure
Phase 3  → Backend/API foundation
Phase 4  → Authentication/RBAC
Phase 5  → Frontend foundation
Phase 6  → Core portfolio workflows
Phase 7  → Transactions and positions
Phase 8  → Tables, filters and analytics
Phase 9  → Realtime
Phase 10 → Background operations
Phase 11 → Demo Mode
Phase 12 → Testing hardening
Phase 13 → Observability
Phase 14 → Deployment
Phase 15 → UX/performance/accessibility refinement
Phase 16 → Portfolio case study and interview readiness
```

After foundational contracts are stable, some phases can proceed in parallel.

Code vs ADR: parallel work between the backend and the frontend does not apply in version 1. The stages run in sequence (§4.1). Inside a stage, blocks follow the order given there.

---

## 4.1 Backend-First Override

**Status:** `Reference`; the stage order is decided (ADR-006 point 1, `00-overview.md` §1)

The phase list in §4 was written as one sequence that alternates backend and frontend work. Development does not follow it. The order is:

1. **Minimal CI** (ADR-006 point 11), `Planned (B0)`.
2. **Backend blocks B0 to B7**, in this order and defined in `BACKEND-ROADMAP.md`:
   - B0: application layer and shared contracts (ADR-001, ADR-002).
   - B1: portfolio performance and risk analytics (ADR-004).
   - B2: authentication and RBAC (ADR-005).
   - B3: observability foundation (ADR-009).
   - B4: background jobs and idempotency (ADR-008).
   - B5: realtime and market simulation (ADR-007).
   - B6: API documentation and contract.
   - B7: deployment readiness and hardening (ADR-006).
3. **Frontend stage**, in the blocks of §4.3: the web app first, then the public demo build (ADR-006 points 1 and 7).

The frontend stage starts when the backend counts as done: blocks B1 to B7 are closed against their own "Done when", the verification loop passes, every deliberate divergence from the SDD is reflected in the SDD, `PROGRESS.md` is current, and the handoff artifacts for the demo exist (`BACKEND-ROADMAP.md` §2 and §6).

What the override changes and what it leaves alone:

- The scope and acceptance content of each phase stay as written in §5 to §21. Only the order and the owner change: each phase belongs to a backend block, to a frontend block, or to both (§4.2).
- Vertical slicing still applies, inside each block and not across the two stages.
- Each block follows the same method: read the real code and the specs, propose small slices, apply, verify, commit.

Code vs ADR:

- `BACKEND-ROADMAP.md` describes this order as a deliberate override of "the plan's rule 11", which would prefer the demo first. §3 of this document has 10 rules and none states that preference, so that citation is stale. It is fixed with the roadmap rewrite (task T5.3).
- `BACKEND-ROADMAP.md` does not list B0 or the minimal CI yet; ADR-001 and ADR-006 add them in front of B1 (same task).

---

## 4.2 Phase-to-Block Mapping

**Status:** per item (table below)

| Phase | Backend | Frontend |
| --- | --- | --- |
| 0 Repository foundation | `Implemented` (pnpm workspace, TypeScript, ESLint, Prettier, Husky); minimal CI `Planned (B0)` | none |
| 1 Product and domain foundation | `Implemented` (`packages/domain`); analytics additions `Planned (B1)`; application layer and `@trading/contracts` `Planned (B0)` | none |
| 2 Database and infrastructure | `Implemented` (Prisma, PostgreSQL through Compose); `Job` and `IdempotencyKey` models `Planned (B4)`; runtime database role `Planned (B0)` | none |
| 3 Backend/API foundation | REST API foundation `Implemented`; layering `Planned (B0)`; OpenAPI document `Planned (B6)` | none |
| 4 Authentication and RBAC | login and `me` `Implemented`; refresh, logout and role enforcement `Planned (B2)` | session screens `Planned (FE1)` |
| 5 Frontend foundation | none | `Planned (FE0)` |
| 6 Core portfolio workflow | endpoints `Implemented` | `Planned (FE1)` |
| 7 Transactions and positions | endpoints `Implemented`; fee handling change `Planned (B1)` | `Planned (FE1)` |
| 8 Tables, filters and analytics | allocation and attribution `Implemented`; performance and risk endpoints `Planned (B1)` | `Planned (FE2)` |
| 9 Realtime | server `Planned (B5)` | client `Planned (FE3)` |
| 10 Background operations | jobs and idempotency `Planned (B4)` | screens `Planned (FE3)` |
| 11 Demo Mode | `@trading/market-sim` `Planned (B5)` | `Planned (FE4)` |
| 12 Testing hardening | route tests `Planned (B0)`; tests per block | component, E2E and accessibility checks `Planned (FE5)` |
| 13 Observability | logger and security events `Planned (B3)`; metrics `Deferred` (ADR-009 point 10) | browser-console `Logger` adapter `Planned (FE0)`; diagnostic modes `Deferred` |
| 14 Deployment | local full stack `Planned (B7)`; CI `Planned (B0)` | demo build and publication `Planned (FE4)`; hosting `Deferred` |
| 15 UX, accessibility and performance refinement | none | `Planned (FE5)` |
| 16 Portfolio case study | none | `Planned (FE6)` |

Code vs ADR: phases 5 to 11 and 14 to 16 were written before the ADRs, and their text still mixes backend and frontend work. They are reconciled slice by slice in §5 to §21.

---

## 4.3 Frontend Blocks

**Status:** `Planned (FE)`; the breakdown below was approved by the user on 2026-10-07 and may be revised when the frontend stage starts

| Block | Scope | Phases | Depends on |
| --- | --- | --- | --- |
| FE0 Foundation | `apps/web` workspace, routing, state, shared UI, English and Spanish (ADR-010 point 8), API client over `@trading/contracts`, `APP_MODE` and base URLs at build time (ADR-006 point 8), browser-console `Logger` adapter | 5, part of 13 | B6; the frontend-stage ADR |
| FE1 Core workflow (real mode) | Session screens, portfolios, transactions, positions | 4 (screens), 6, 7 | FE0; B2 |
| FE2 Analytics and tables | Performance, risk, pulse, allocation and attribution views; tables, filters and sorting | 8 | FE1; B1 |
| FE3 Realtime and jobs | WebSocket client, notifications and alerts, CSV import screens and job progress | 9, 10 | FE1; B4; B5 |
| FE4 Demo mode | In-process adapters over the same application layer, `@trading/market-sim`, role selector, static build and its publication | 11, demo part of 14 | FE0; B0; B5 |
| FE5 Quality and refinement | Component, E2E and accessibility checks (ADR-006 point 11), performance, UX refinement | 12 (frontend part), 15 | FE1 to FE4 |
| FE6 Case study | Portfolio case study and interview readiness | 16 | FE5 |

Open before FE0 starts: the frontend-stage ADR. It settles what no ADR decides today: routing, state, rendering and charts, shared UI, the accessibility tool, the HTTP client timeout and retry (ADR-006 point 11), the frontend test tooling, and the demo specifics (ADR-010 point 6).

---

## 5. Phase 0 — Repository Foundation

**Status:** per item (table below)

**Owning blocks:** Backend: B0 (minimal CI, runtime version pin, lint boundary); Frontend: none.

| Deliverable | Status | Block |
| --- | --- | --- |
| Git repository and `.gitignore` (excludes `.env`, `.env.*.local`, build output and `pr-body.md`) | `Implemented` | none |
| Repository structure: pnpm workspace over `apps/*` and `packages/*` (`pnpm-workspace.yaml`) | `Implemented`; `packages/contracts`, `packages/config` and `docker/` hold only `.gitkeep`, and `apps/web` holds only the wireframe | none |
| Package manager and committed lockfile (`packageManager` `pnpm@12.3.4`, `pnpm-lock.yaml`) | `Implemented` | none |
| TypeScript (`tsconfig.base.json`, root `tsconfig.json` with references to `packages/domain`, `packages/database` and `apps/api`, `pnpm typecheck`) | `Implemented` | none |
| Alignment of the `typescript` and `@types/node` versions across packages | Open (the versions differ, see Code vs ADR) | B0 |
| ESLint (`eslint.config.js`, `pnpm lint`) | `Implemented` | none |
| ESLint import-boundary rule for the application layer (ADR-001 point 1) | `Planned (B0)`; the config holds only a commented placeholder | B0 |
| Prettier (`.prettierrc.json`, `pnpm format`, `pnpm format:check`) | `Implemented` | none |
| Editor conventions | Decided (user, 2026-10-07): nothing is added in version 1; no `.editorconfig` or `.vscode/` exists and Prettier is the only formatting convention | none |
| `.env.example` and `.env.test.example` | `Implemented`; the content of `.env.example` is stale (see Code vs ADR) | the block that adds each variable |
| Basic commands documented | `Implemented` in `README.md` (setup and local database); `CONTRIBUTING.md` has no setup section | none (documentation work, T5.2) |
| Commit workflow: Conventional Commits (`CONTRIBUTING.md` §6) and a Husky pre-commit hook running `lint-staged` | `Implemented` (`.husky/pre-commit`, `lint-staged` in the root `package.json`) | none |
| Pull request template (`.github/PULL_REQUEST_TEMPLATE.md`) | `Implemented`; its checklist asks only for `pnpm typecheck` and `pnpm lint` | none (documentation work, T5.2) |
| Minimal CI workflow: install with the lockfile, typecheck, lint, `format:check`, `docs:check`, `build`, and the domain, database and API suites against a PostgreSQL service container (ADR-006 points 10 and 11) | `Planned (B0)` | B0 |
| Test variables supplied through the job `env`, not a generated `.env.test.local` (ADR-006 point 11) | `Planned (B0)` | B0 |
| `.nvmrc` as the single Node.js version source, reused by CI and the Dockerfile (ADR-006 point 13) | `Planned (B0)`; `engines.node` is `>=22.0.0` today | B0 |
| Docker Compose with PostgreSQL in the default profile (`docker-compose.yml`, `postgres:18`) | `Implemented`; detail in §7 | none |
| API Dockerfile and the Compose `full` profile (ADR-006 point 4) | `Planned (B7)`; detail in §7 | B7 |

Code vs ADR:

- No workflow exists. `.github/` holds only `PULL_REQUEST_TEMPLATE.md`. The acceptance criteria below (clean install, typecheck, lint, formatting) are checked by hand today. The minimal CI automates them and comes first in the build order (§4.1).
- ADR-006 point 10 names install, typecheck, lint and the three suites. Point 11 adds `pnpm format:check` and `pnpm build`, and its additions of 2026-10-07 add `pnpm docs:check`, because `docs/` is in `.prettierignore` and `format:check` never covers the SDD. Hardening `scripts/check-docs.mjs` (task T1.5: one shared fence-state helper and fixture-based tests) is not decided in an ADR and stays open for B0.
- There is no `.nvmrc`. The exact Node.js major is chosen in B0 after confirming it is an LTS release (ADR-006 point 13), and `engines.node` and `@types/node` are aligned to it.
- The `test` scripts of `apps/api` and `packages/database` load `../../.env.test.local` through `dotenv-cli`. That file is git-ignored, so a clean checkout does not have it; CI supplies the variables through the job `env` instead (`14-deployment-spec.md` §43).
- "No secrets exist in Git" holds: the only tracked environment files are `.env.example` and `.env.test.example`. The Compose fallback password (`trading_dev_password`) differs from the `.env.example` placeholder; both are local-only values (`14-deployment-spec.md` §6).
- `.env.example` opens with a stale Spanish note and lacks `LOG_LEVEL` and `SLOW_REQUEST_THRESHOLD_MS` (B3) and `APP_MODE` (FE). Each variable is added by the block that introduces it (`14-deployment-spec.md` §11).
- `typescript` is `^6.0.3` in the root and in `apps/api` but `^5.7.3` in `packages/domain` and `packages/database`; `@types/node` is `^22` in `apps/api` and `^26` in the root and in `packages/database`.
- The Husky hook runs `lint-staged` only (ESLint and Prettier on staged files). It runs no typecheck or tests; CI is the gate for those.

### Objective

Create the repository structure and development conventions.

### Tasks

- initialize Git repository
- define repository structure
- initialize the package manager
- commit the lockfile
- configure TypeScript
- configure ESLint
- configure Prettier
- configure editor conventions
- configure `.gitignore`
- create `.env.example`
- document basic commands
- establish a coherent commit workflow

### Acceptance Criteria

- a clean clone can install dependencies
- TypeScript works
- linting works
- formatting works
- no secrets exist in Git
- basic development instructions are documented

---

## 6. Phase 1 — Product and Domain Foundation

**Status:** per item (table below)

**Owning blocks:** Backend: B0 (application layer, contracts, `Clock` port), B1 (analytics additions); Frontend: none. The demo reuses the same domain and application layer in FE4.

| Deliverable | Status | Block |
| --- | --- | --- |
| Domain entities and enums (`packages/domain/src/entities`: 16 entities, each with tests, and `enums.ts`) | `Implemented` | none |
| Value objects (`Money`, `packages/domain/src/value-objects/money.ts`) | `Implemented` | none |
| Domain invariants (per-entity validators and `Invalid*Error` / `Insufficient*Error` types) | `Implemented` | none |
| Ownership rules (every portfolio carries a `userId`; foreign resources return 404, never 403) | `Implemented` in `apps/api/src/services`; permission checks through an `Actor` (ADR-005 point 3) `Planned (B2)` | B2 |
| Transaction states (`TransactionStatus`: `DRAFT`, `VALIDATING`, `PROCESSING`, `COMPLETED`, `FAILED`) | `Implemented` | none |
| Deterministic tiebreak for transactions with the same `executedAt` (ADR-003 Deferred detail) | `Planned (B0)` | B0 |
| Portfolio calculations and derived data: allocation, current-state attribution, portfolio and position metrics, daily change, Pulse, asset-level volatility and drawdown, decision replay, scenario impact and comparison (`packages/domain/src/calculations`) | `Implemented` | none |
| Analytics additions: portfolio-level performance (TWR), risk series, period handling, realized P/L, range attribution, fee handling change, `Decimal` end to end (ADR-004, `16-analytics-spec.md`) | `Planned (B1)` | B1 |
| Domain `quantity` as a plain `number` | Open: no ADR decides it | B1 |
| `@trading/application` (use cases moved out of `apps/api/src/services`, ADR-001) | `Planned (B0)` | B0 |
| `@trading/contracts` (request and response schemas, error envelope, presenters, DTO types, ADR-002) | `Planned (B0)` | B0 |
| One shared `Clock` port; `validateNewTransaction` receives the time instead of calling `new Date()` (ADR-001 point 8) | `Planned (B0)` | B0 |
| Money, prices and quantities in persisted JSON as decimal strings; `decision-replay.ts` and `scenario-impact.ts` stop using floating point (ADR-002 point 9) | `Planned (B0)` | B0 |
| Core business rules testable without React, Express or PostgreSQL (acceptance criterion) | `Implemented`: `@trading/domain` depends only on `decimal.js` and has its own Vitest suite | none |

Code vs ADR:

- The initial concepts below are a "may include" list, and the final model follows the product and functional specifications. Against the real model: `Instrument` is `Asset`; `Role` is the `UserRole` enum (`USER` and `ADMIN` today, `VIEWER`, `TRADER` and `ADMIN` in ADR-005 point 1, `Planned (B2)`); `PortfolioMember` has no entity, because every portfolio belongs to one user and collaboration is out of scope (`05-data-model.md` §49); `PriceSnapshot` is `MarketPrice` and `HistoricalPrice`; `AnalyticsSnapshot` has no entity, because analytics are computed from transactions and prices (ADR-004) and portfolio snapshots are `Deferred`; `BackgroundJob` is the `Job` entity, `Planned (B4)` (ADR-008). `Credential`, `WatchlistItem`, `Alert`, `Decision`, `DecisionEvent`, `Scenario`, `UserPreference` and `MarketEvent` exist in the code and are not in the list.
- The application layer is still inside `apps/api/src/services`, and those services create Prisma repositories directly (for example `auth.service.ts`). Rules that live there cannot be tested without Prisma until `@trading/application` exists (`06-architecture.md` §11, ADR-001).
- The analytics rows marked `Implemented` cover the current-state and asset-level metrics only. The status of each analytics item is in `16-analytics-spec.md`.

### Objective

Translate the product specification into explicit domain concepts.

Initial concepts may include:

```text
User
Role
Portfolio
PortfolioMember
Instrument
Position
Transaction
PriceSnapshot
AnalyticsSnapshot
BackgroundJob
Notification
```

The final model must follow the product and functional specifications.

### Tasks

- define domain entities
- define value objects where useful
- define enums
- define domain invariants
- define ownership rules
- define transaction states
- define portfolio calculations
- identify derived data

### Acceptance Criteria

Core business rules can be tested without React, Express, or PostgreSQL.

---

## 7. Phase 2 — Database and Infrastructure

**Status:** per item (table below)

**Owning blocks:** Backend: B0 (runtime database role, seed and reset guard, in-memory repositories), B2 (`Session`), B4 (`Job`, `IdempotencyKey`), B7 (Dockerfile, `full` profile, production migration path); Frontend: none (the demo data layers are `Deferred` to the frontend-stage ADR, ADR-010 point 6).

| Deliverable | Status | Block |
| --- | --- | --- |
| PostgreSQL through Docker Compose, default profile with PostgreSQL only (`docker-compose.yml`: `postgres:18`, named volume, healthcheck) | `Implemented` | none |
| Docker: multi-stage API Dockerfile, non-root user, `apps/api/Dockerfile` (ADR-006 point 4) | `Planned (B7)`; `docker/` holds only `.gitkeep` | B7 |
| Compose `full` profile: PostgreSQL, a one-shot `migrate` service and the API (ADR-006 point 4) | `Planned (B7)` | B7 |
| Migration tooling: Prisma (`packages/database/prisma`) | `Implemented` | none |
| Initial schema and migrations (`schema.prisma`: 12 enums and 16 models; 10 migrations) | `Implemented` | none |
| `Session` (refresh tokens, `05-data-model.md` §5.3) | In `05`, not in `schema.prisma`; `Planned (B2)` | B2 |
| `Job` and `IdempotencyKey` (`05-data-model.md` §52 and §53) | In `05`, not in `schema.prisma`; `Planned (B4)` | B4 |
| Seed workflow (`packages/database/prisma/seed.ts`, `src/seed`, `pnpm --filter @trading/database db:seed`) | `Implemented`; the production guard (ADR-006 point 13) `Planned (B0)` | B0 |
| Local reset workflow: light reset by rerunning the seed, hard reset by `db:reset` (`prisma migrate reset`) | `Implemented`; the production guard `Planned (B0)` | B0 |
| Database connection (`packages/database/src/client.ts`, shared `prisma` client) | `Implemented`; `DATABASE_URL` validation at startup `Planned (B7)` | B7 |
| Separate runtime database role without DDL rights; only the migration role keeps them (ADR-005 point 13) | `Planned (B0)` | B0 |
| Repository interfaces (`packages/domain/src/repositories`) | `Implemented` | none |
| PostgreSQL repositories, mappers and `PrismaUnitOfWork` (`packages/database/src`) | `Implemented` | none |
| In-memory repositories and `UnitOfWork` (ADR-001 point 7, `06-architecture.md` §12 and §13) | `Planned (B0)` | B0 |
| Production migration path: `prisma migrate deploy` in the `migrate` service (ADR-006 points 4 and 5) | `Planned (B7)` | B7 |
| `TZ=UTC` on the API and PostgreSQL containers; Prisma `connection_limit` (default until measured) | `Planned (B7)` | B7 |

Code vs ADR:

- The acceptance sequence works locally by hand: `docker compose up -d`, then `pnpm --filter @trading/database db:migrate`, then `db:seed`, then `pnpm --filter @trading/api dev`. No root script chains it. The CI form (migrate with `db:test:migrate`, no seed) is `Planned (B0)` (ADR-006 point 11).
- `db:migrate` runs `prisma migrate dev`. The production path is `migrate deploy` (ADR-006 point 5), which exists only as `db:test:migrate` today.
- The seed always wipes the database first and has no guard. ADR-006 point 13 makes the seed and the hard reset refuse to run when `NODE_ENV=production` (`Planned (B0)`).
- The API connects as the PostgreSQL superuser of the container. The data-only runtime role of ADR-005 point 13 is `Planned (B0)`.
- The PostgreSQL port is published on every host interface, and binding it to `127.0.0.1` is still open (B7). Compose has no profiles yet, so the default profile and the future `full` profile share one file.
- Migrations declare `TIMESTAMP(3)` columns without a time zone. The containers run with `TZ=UTC` (ADR-006 point 4, `Planned (B7)`).
- The domain defines the repository interfaces and `@trading/database` implements them, as the objective requires. Domain logic does not import Prisma. The services in `apps/api` still import the Prisma repositories directly until the composition root of ADR-001 point 4 exists (B0).

### Objective

Create persistent infrastructure without coupling domain logic directly to PostgreSQL.

### Tasks

- configure PostgreSQL
- configure Docker
- configure Docker Compose
- select migration tooling
- create initial schema
- implement migrations
- create seed workflow
- create local reset workflow
- configure database connection
- define repository interfaces
- implement PostgreSQL repositories

### Acceptance Criteria

A clean environment can:

```text
start database
→ migrate
→ seed
→ run application
```

---

## 8. Phase 3 — Backend/API Foundation

**Status:** per item (table below)

**Owning blocks:** Backend: B0 (layering, `Clock` port, route tests, error contract, route parameters, contracts), B2 (authorization middleware), B3 (logger, graceful shutdown), B6 (OpenAPI), B7 (`DATABASE_URL` validation); Frontend: none.

| Deliverable | Status | Block |
| --- | --- | --- |
| Express application (`apps/api/src/app.ts` `createApp()`, `index.ts` listening on `PORT`, default `7001`) | `Implemented` | none |
| Middleware: helmet, CORS from `CORS_ORIGIN`, request ID, JSON body limit of 100 kb | `Implemented` | none |
| Rate limiting: a general limiter (300 requests per 15 minutes) and a login limiter (5 per 15 minutes), disabled under `NODE_ENV=test` | `Implemented` | none |
| `CORS_ORIGIN` accepts only `http(s)://host[:port]` and rejects `*` (ADR-006 point 13) | `Planned (B0)` | B0 |
| Configuration validation at startup (`config/env.ts`: `NODE_ENV`, `PORT`, `JWT_SECRET` of at least 32 characters, `JWT_EXPIRES_IN_SECONDS`, `CORS_ORIGIN`; exits on failure) | `Implemented`; `DATABASE_URL` is not validated, `Planned (B7)` | B7 |
| Request validation of body and query with Zod (`middleware/validate.ts`) | `Implemented` | none |
| Request validation of route parameters (ADR-002 point 10) | `Planned (B0)` | B0 |
| Consistent error handling (`errors/app-error.ts`, `middleware/error-handler.ts`, envelope `{ error: { code, message, requestId, details? } }`) | `Implemented` | none |
| Error contract changes: `{ field, code, message }` validation details, `TIMEOUT` removed from `AppErrorCode`, 503 `DEPENDENCY_ERROR` on a database outage (ADR-002 point 10) | `Planned (B0)` | B0 |
| Request IDs (`middleware/request-id.ts`, `X-Request-ID`, bounded safe pattern) | `Implemented`; exposing the header through CORS `Planned (B3)` | B3 |
| API response conventions: `/api/v1` paths and paginated lists with `meta` | `Implemented` | none |
| `@trading/contracts`: response schemas, presenters and DTO types (ADR-002) | `Planned (B0)` | B0 |
| Authentication middleware (`middleware/authenticate.ts`) | `Implemented` | none |
| Authorization middleware (`requireRole`, permission checks through the `Actor`) | `Planned (B2)`; see §9 | B2 |
| Application services | `Implemented` inside `apps/api/src/services`; `@trading/application` and the composition root (`apps/api/src/composition.ts`) `Planned (B0)` (ADR-001) | B0 |
| Repository integration | `Implemented`: the services create the Prisma repositories directly | B0 (composition root) |
| One shared `Clock` port (ADR-001 point 8) | `Planned (B0)` | B0 |
| Route tests for analytics, positions, assets, market and health, written before the layering refactor (ADR-001 point 8) | `Planned (B0)` | B0 |
| Health endpoints: `GET /health` (liveness) and `GET /health/ready` (readiness, database check), registered before the rate limiter | `Implemented` | none |
| `GET /health/ready` returns 503 with `status: "unavailable"` and no `checks` while the API shuts down (ADR-006 point 12) | `Planned (B3)` | B3 |
| Safe structured logging: `Logger` port in `@trading/application`, pino adapter, request logs, security events (ADR-009) | `Planned (B3)`; see Code vs ADR for what exists | B3 |
| Graceful shutdown on `SIGTERM` and `SIGINT` (ADR-006 point 12) | `Planned (B3)` | B3 |
| OpenAPI document generated from the `@trading/contracts` schemas (ADR-002 point 7) | `Planned (B6)` | B6 |

Code vs ADR:

- The boundary diagram below lists Infrastructure last. The dependency direction follows ADR-001: `@trading/application` depends only on `@trading/domain`, the Prisma repositories implement the domain's repository interfaces, and the composition root wires them together. Domain and application code never import Express or Prisma.
- Today the boundary is not enforced. Routes call controllers, controllers call services in `apps/api/src/services`, and those services import `@trading/database` directly. The import-boundary lint rule and the move to `@trading/application` are `Planned (B0)`. The route tests come first so the refactor can be shown to keep HTTP behavior unchanged.
- Logging today is `console.log` at startup (`index.ts`) and two `console.error(JSON.stringify(...))` lines (`request.failed` in the error handler, `health.database.unavailable` in the readiness controller). There is no logger module, no request logging and no `no-console` rule. ADR-009 decides `pino`, `pino-http` and `pino-pretty`.
- `index.ts` is `createApp()` plus `listen()`. There is no signal handling and no drain of in-flight requests (ADR-006 point 12 requires a 10 second drain).
- A database outage on a normal request returns 500 `INTERNAL_ERROR`, not the 503 `DEPENDENCY_ERROR` of ADR-002 point 10. `GET /health/ready` returns 503 on an unreachable database but 200 on an unmigrated one. `AppErrorCode` still declares `TIMEOUT`.
- Route parameters are not schema-validated: `validate` accepts only `body` and `query`. A malformed ID is therefore not a 400 `VALIDATION_ERROR` today.
- No test covers `GET /health` or `GET /health/ready`, although NFR-051 is `Implemented`. Analytics, positions, assets and market also have no route test file.
- Acceptance criteria against the code: the API starts cleanly, validates its configuration, connects to PostgreSQL through the shared client, exposes health and readiness, returns the consistent error envelope and supports request correlation through `X-Request-ID` (all `Implemented`). Structured diagnostics are partial until B3.

### Objective

Build the backend application structure.

Recommended boundary:

```text
API
 ↓
Application
 ↓
Domain
 ↓
Infrastructure
```

### Tasks

- initialize Express
- configure middleware
- implement request validation
- implement consistent error handling
- implement request IDs
- establish API response conventions
- establish authentication middleware
- establish authorization middleware
- implement application services
- integrate repositories
- implement health endpoints
- implement safe structured logging

### Acceptance Criteria

The API:

- starts cleanly
- validates configuration
- connects to PostgreSQL
- exposes health/readiness information
- returns consistent errors
- produces structured diagnostics
- supports request correlation

---

## 9. Phase 4 — Authentication and RBAC

**Status:** per item (table below)

**Owning blocks:** Backend: B0 (login timing, route parameters), B2 (refresh, logout, roles, permissions); Frontend: FE1 (session screens and in-memory access token), FE4 (demo role selector).

| Deliverable | Status | Block |
| --- | --- | --- |
| User model (`User`, `Credential` in a separate table) | `Implemented` | none |
| Password handling (`bcryptjs`, ADR-005 point 12) | `Implemented` | none |
| Login (`POST /api/v1/auth/login`, limited to 5 attempts per 15 minutes) and `GET /api/v1/auth/me` | `Implemented` | none |
| Login response `{ user, session: { accessToken, expiresAt } }` (ADR-005 point 8); today the response carries `token` | `Planned (B2)` | B2 |
| Login timing equalization: a `bcryptjs` check against a fixed dummy hash when the user does not exist (ADR-005 point 13) | `Planned (B0)` | B0 |
| Access token generation and validation (`jsonwebtoken`, payload `sub` and `role`, `JWT_EXPIRES_IN_SECONDS` default 900, which is the 15 minutes of ADR-005 point 4) | `Implemented` | none |
| Authentication middleware (`authenticate`: one generic 401 for every failure) | `Implemented` | none |
| Refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie with rotation and family revocation, `POST /api/v1/auth/refresh`, `Session` table, custom request header (ADR-005 points 5 to 7) | `Planned (B2)` | B2 |
| `POST /api/v1/auth/logout` (ADR-005 point 6) and the `auth.logout` security event (ADR-009) | `Planned (B2)` | B2 |
| Role model: `USER` and `ADMIN` today | `Implemented`; `VIEWER`, `TRADER` and `ADMIN`, with `USER` migrated to `TRADER` (ADR-005 point 1), `Planned (B2)` | B2 |
| Permission matrix, `Actor { userId, role }` and enforcement in the application layer (ADR-005 points 2 and 3); `requireRole` and the 403 `FORBIDDEN` code | `Planned (B2)` | B2 |
| `VIEWER` self-service (own preferences and own notifications read) and `ADMIN` limited to `TRADER` plus `simulation:control` (ADR-005 point 13) | `Planned (B2)` | B2 |
| Protected routes: every `/api/v1` route except login runs `authenticate` | `Implemented` | none |
| Ownership checks: another user's resource returns 404, never 403 (ADR-005 point 12) | `Implemented` | none |
| Authentication tests: login success, wrong password, unknown email, `/me` without a token, `/me` with a malformed token (`apps/api/src/routes/auth.routes.test.ts`) | `Implemented`; no test covers an expired or wrongly signed token; those tests are `Planned (B2)` with the refresh tests (decided by the user, 2026-10-07) | `Planned (B2)` |
| Authorization tests: cross-user access returns 404 (portfolio route tests) | `Implemented`; role tests `Planned (B2)` | B2 |
| Session screens: login, logout, session expiry handling, access token kept in memory only (ADR-005 point 4) | `Planned (FE1)` | FE1 |
| Demo identity with a role selector (Viewer, Trader, Admin) going through the same permission checks (ADR-005 point 11) | `Planned (FE4)` | FE4 |

Code vs ADR:

- The code has `USER` and `ADMIN`. ADR-005 point 1 decides `VIEWER`, `TRADER` and `ADMIN`. Nothing checks `role` today: `authenticate` only attaches `req.auth.role` (a plain string), so there is no authorization middleware and the "permission checks" and "protected resources enforce authorization" items below hold only for ownership.
- ADR-005 point 3 puts permission enforcement in the application layer, not in Express middleware, which only authenticates and builds the `Actor`. The `Actor` therefore depends on `@trading/application` (B0) before B2 can enforce roles.
- There is no refresh, no logout and no sessions table. The access token lives 15 minutes (the `JWT_EXPIRES_IN_SECONDS` default), and an issued token stays valid until it expires even after a logout exists (ADR-005 point 6).
- Acceptance criteria against the code: unauthenticated and invalid requests are rejected with a generic 401, and an expired token is rejected by `jsonwebtoken` verification, but no test asserts the expired or wrong-signature case. No ADR or NFR assigns those tests to a block; the user assigned them to B2, alongside the refresh tests (2026-10-07). The role-based part of "protected resources enforce authorization" is `Planned (B2)`.
- The principle below stays as written: the frontend check is a UX convenience and the backend check is the security boundary. In demo mode the same permission checks run in-process (ADR-005 points 3 and 11), so the rule holds without a backend.

### Objective

Implement secure access control.

### Tasks

- user model
- password handling
- login
- token generation
- token validation
- authentication middleware
- role model
- permission checks
- protected routes
- authentication tests
- authorization tests

### Principles

```text
Frontend authorization check
→ UX convenience

Backend authorization check
→ Security boundary
```

### Acceptance Criteria

- unauthenticated requests are rejected
- invalid tokens are rejected
- expired tokens are rejected
- protected resources enforce authorization
- frontend visibility does not replace backend authorization

---

## 10. Phase 5 — Frontend Foundation

**Status:** per item (table below); the whole phase is frontend stage work and `apps/web` holds only a wireframe

**Owning blocks:** Backend: none (FE0 depends on B6, the documented API contract); Frontend: FE0 (§4.3). The frontend-stage ADR must exist before FE0 starts (§4.3).

| Deliverable | Status | Block |
| --- | --- | --- |
| Frontend-stage ADR: routing, state, rendering library, charts, shared UI, accessibility tool, HTTP client timeout and retry, frontend test tooling, demo specifics (ADR-010 point 6, ADR-006 point 11) | Open: not written | before FE0 |
| `apps/web` workspace (package, scripts, build); `apps/web` holds `wireframe.html`, `WIREFRAME-PLAN.md` and `.gitkeep` | `Planned (FE0)` | FE0 |
| Vite as the build tool (ADR-006 point 8) | `Planned (FE0)` | FE0 |
| React as the rendering library | `Deferred` to the frontend-stage ADR (`04-tech-stack.md` §4) | FE0 |
| TypeScript for `apps/web` | `Planned (FE0)` | FE0 |
| Tailwind CSS, shadcn/ui, shared UI structure and design tokens | `Deferred` to the frontend-stage ADR (`04-tech-stack.md` §7 and §8) | FE0 |
| Routing | `Deferred` to the frontend-stage ADR | FE0 |
| Server state (TanStack Query), client state (Zustand "where justified"), forms (React Hook Form) | `Deferred` to the frontend-stage ADR (`04-tech-stack.md` §10, §11 and §13) | FE0 |
| Request and response types (DTOs) consumed from `@trading/contracts` (ADR-002 point 5) | `Planned (FE0)`; the package is `Planned (B0)` | FE0 |
| Feature structure (the `src/` layout below) | `Deferred` to the frontend-stage ADR (`06-architecture.md` §7 and §8) | FE0 |
| `TradingClient` port with the HTTP adapter over `@trading/contracts` (ADR-002 point 5); the in-process adapter is FE4 | `Planned (FE0)` | FE0 |
| Application shell: icon rail, top bar and status bar (`11-ui-ux-spec.md`) | `Planned (FE0)` | FE0 |
| English and Spanish (ADR-010 point 8): English initially, Spanish only after the user selects it, localized messages mapped from error codes, locale formatting | `Planned (FE0)` | FE0 |
| `APP_MODE` and the API and WebSocket base URLs as build-time values (`VITE_APP_MODE`, proposed `VITE_API_BASE_URL` and `VITE_WS_URL`; ADR-006 point 8) | `Planned (FE0)` | FE0 |
| Browser-console `Logger` adapter (ADR-009 point 1) | `Planned (FE0)`; the `Logger` port is `Planned (B3)` | FE0 |
| Wireframe corrections: `lang="es"` becomes English and `WIREFRAME-PLAN.md` is updated (ADR-010 point 8) | `Planned (FE0)` | FE0 |

Code vs ADR:

- The task list below names React, Tailwind CSS, shadcn/ui, TanStack Query, Zustand and React Hook Form. No ADR decides them, and `04-tech-stack.md` marks them `Deferred`. The list is kept as the original intent, not as a decision. Only Vite is decided (ADR-006 point 8).
- This phase was written to follow Phase 4 so the frontend could start early. Under the backend-first override (§4.1) it starts after B1 to B7 are closed, and FE0 is its only block.
- FE0 builds on backend deliverables: the DTOs and schemas in `@trading/contracts` (B0) and the documented API contract (B6). The web build reads no secrets, and the demo bundle contains no HTTP adapter (ADR-006 points 7 and 8).
- `lang="es"` in `apps/web/wireframe.html` contradicts ADR-010 point 8, which makes English the initial language; the wireframe is a visual reference, not production code.
- The API's `CORS_ORIGIN` defaults to `http://localhost:5173`, the Vite dev server default. The real-mode web app runs on the Vite dev server against the local API (ADR-006 point 8). The API does not expose `X-Request-ID` through CORS, so a browser client cannot read it until B3 adds that.

### Objective

Build the application shell and frontend architecture.

### Tasks

- initialize React + Vite
- configure TypeScript
- configure Tailwind CSS
- configure shadcn/ui
- configure routing
- configure TanStack Query
- configure Zustand where justified
- configure React Hook Form
- configure Zod
- establish feature structure
- establish shared UI structure
- establish design tokens
- implement app shell

Suggested structure:

```text
src/
├── app/
├── features/
├── components/
├── layouts/
├── lib/
├── hooks/
├── services/
├── stores/
├── types/
└── styles/
```

The final structure may evolve during implementation.

---

## 11. Phase 6 — Core Portfolio Workflow

### Objective

Deliver the first complete vertical product slice.

Recommended flow:

```text
Login
 ↓
Dashboard
 ↓
Portfolio
 ↓
Portfolio details
 ↓
Positions
 ↓
Transactions
```

### Tasks

- dashboard shell
- portfolio listing
- portfolio detail
- authentication state
- API integration
- navigation
- loading states
- empty states
- error states
- responsive behavior

### Acceptance Criteria

A user can complete the primary portfolio workflow against the real backend.

---

## 12. Phase 7 — Transactions and Positions

### Objective

Implement the core trading-domain workflows.

### Tasks

- create transaction
- edit transaction where permitted
- delete/cancel where permitted
- transaction validation
- position calculation
- position updates
- transaction history
- duplicate prevention
- conflict handling
- derived values
- user feedback

### Important Principle

Transaction state must have a clear authoritative source.

Business rules should not be duplicated independently across:

```text
React
API controller
repository
```

Domain/application services remain responsible for business behavior.

---

## 13. Phase 8 — Tables, Filters and Analytics

### Objective

Implement complex data exploration.

### TanStack Table

Use TanStack Table for:

- transaction tables
- position tables
- portfolio datasets
- analytics datasets where appropriate

Features:

- sorting
- filtering
- pagination
- column visibility
- responsive behavior
- loading state
- empty state
- error state

### Analytics

Implement only metrics defined by the product specification.

Possible categories:

```text
portfolio value
P&L
returns
win/loss statistics
exposure
drawdown
transaction statistics
```

Exact formulas must be explicitly defined and tested.

---

## 14. Phase 9 — Realtime

### Objective

Introduce realtime behavior without creating a parallel application architecture.

### Tasks

- WebSocket server
- connection lifecycle
- authentication
- subscriptions
- typed event contracts
- event validation
- client connection manager
- reconnection
- resynchronization
- market simulation
- UI update strategy
- cleanup

### Recommended Order

```text
WebSocket connection
 ↓
authentication
 ↓
subscription
 ↓
single event
 ↓
multiple events
 ↓
reconnect
 ↓
resync
 ↓
performance validation
```

Do not build complex market simulation before the transport itself is stable.

---

## 15. Phase 10 — Background Operations

### Objective

Implement long-running operations.

Possible examples:

- analytics recalculation
- data import
- report generation
- file generation
- expensive portfolio processing

### Required States

```text
queued
running
completed
failed
cancelled
timeout
```

### UI Requirements

The frontend should expose:

- progress
- current state
- errors
- cancellation where supported
- completion feedback
- resulting artifact/data

---

## 16. Phase 11 — Demo Mode

### Objective

Create a public demo that behaves like a product rather than a static prototype.

Follow `12-demo-mode-spec.md`.

### Tasks

- runtime mode selection
- mock repositories
- mock services
- deterministic seed
- local persistence
- simulated latency
- failure injection
- simulated realtime
- market scenarios
- background job simulation
- demo authentication
- reset
- diagnostics

### Acceptance Criteria

The public demo can operate without:

- paid market APIs
- production database
- production WebSocket infrastructure
- private backend services

The same product/application behavior should remain conceptually shared with the real implementation.

---

## 17. Phase 12 — Testing Hardening

### Objective

Increase confidence across the system.

Follow `10-testing-strategy.md`.

### Test Layers

```text
Unit
 ↓
Integration
 ↓
Component
 ↓
E2E
```

### Priority Areas

#### Domain

- calculations
- invariants
- transaction rules

#### API

- validation
- authentication
- authorization
- errors

#### Frontend

- forms
- tables
- filters
- loading/error states

#### Realtime

- connect
- disconnect
- reconnect
- event processing

#### Demo

- simulation
- failures
- reset
- persistence

#### E2E

- login
- portfolio workflow
- transaction workflow
- analytics
- realtime
- recovery

---

## 18. Phase 13 — Observability

### Objective

Make runtime behavior diagnosable.

Follow `13-observability-spec.md`.

### Tasks

- structured logging
- request IDs
- error categorization
- health checks
- readiness
- metrics
- realtime diagnostics
- background-job diagnostics
- performance measurements
- local debugging tools

### Acceptance Criteria

A developer can diagnose:

- API failures
- database failures
- authentication failures
- realtime disconnects
- background operation failures

without requiring a paid external monitoring service.

---

## 19. Phase 14 — Deployment

### Objective

Make the system reproducibly deployable.

Follow `14-deployment-spec.md`.

### Tasks

- production frontend build
- production backend build
- production Docker image
- environment configuration
- migration deployment
- health checks
- smoke tests
- HTTPS/WSS configuration
- deployment documentation
- rollback documentation

### Acceptance Criteria

A production-like deployment can be started and verified through documented steps.

---

## 20. Phase 15 — UX, Accessibility and Performance Refinement

### Objective

Polish the product after the functional architecture is stable.

### UX

Review:

- hierarchy
- spacing
- typography
- visual consistency
- feedback
- empty states
- error states
- motion
- responsive behavior

### Accessibility

Validate:

- keyboard navigation
- focus management
- labels
- semantic structure
- screen reader support
- reduced motion
- contrast

### Performance

Measure before optimizing.

Potential areas:

- unnecessary React renders
- query caching
- table rendering
- chart rendering
- bundle size
- realtime update frequency
- expensive calculations
- network payloads

---

## 21. Phase 16 — Portfolio Case Study

### Objective

Transform the implemented system into evidence of engineering capability.

The final case study must be based on actual implementation evidence.

Recommended structure:

```text
Problem
 ↓
Context
 ↓
Goals
 ↓
Constraints
 ↓
Architecture
 ↓
Key decisions
 ↓
Implementation
 ↓
Challenges
 ↓
Testing
 ↓
Performance
 ↓
Security
 ↓
Demo
 ↓
Outcomes
 ↓
Lessons
 ↓
Future evolution
```

Do not publish metrics or outcomes until they have actually been measured.

---

## 22. Dependency Graph

```text
Repository
    ↓
Domain
    ↓
Database
    ↓
Backend
    ↓
Auth
    ↓
Frontend
    ↓
Core workflows
    ↓
Transactions
    ↓
Analytics
    ↓
Realtime
    ↓
Background operations
    ↓
Demo
    ↓
Testing
    ↓
Observability
    ↓
Deployment
    ↓
Case Study
```

Once contracts are stable, some implementation work may proceed concurrently.

---

## 23. Recommended Vertical Slices

### Slice 1 — Authentication

```text
User
→ Login
→ Authenticated shell
```

### Slice 2 — Portfolio

```text
Portfolio
→ API
→ Database
→ UI
```

### Slice 3 — Transaction

```text
Transaction
→ Validation
→ Persistence
→ Position update
→ UI
```

### Slice 4 — Analytics

```text
Analytics
→ Calculation
→ API
→ Table/chart
```

### Slice 5 — Realtime

```text
Event
→ Server
→ Client
→ UI
```

### Slice 6 — Background Operation

```text
Job
→ Progress
→ Completion
→ UI
```

### Slice 7 — Demo

```text
Same flow
→ Mock infrastructure
```

---

## 24. Contract-First Boundaries

Before implementing a major feature, define:

```text
Domain behavior
Application use case
API contract
Persistence contract
Frontend data contract
```

Then implement each side.

This reduces accidental coupling.

---

## 25. API Implementation Order

Recommended:

```text
Health
 ↓
Auth
 ↓
Users / session
 ↓
Portfolios
 ↓
Positions
 ↓
Transactions
 ↓
Analytics
 ↓
Background jobs
 ↓
Notifications
```

Realtime capabilities should be implemented alongside the corresponding domain capabilities.

---

## 26. Database Implementation Order

Recommended:

```text
Users / Roles
 ↓
Portfolios
 ↓
Instruments
 ↓
Transactions
 ↓
Positions
 ↓
Price data
 ↓
Analytics support data
 ↓
Jobs / Notifications
```

Foreign keys and constraints should reflect domain ownership.

---

## 27. Frontend Implementation Order

Recommended:

```text
App shell
 ↓
Authentication
 ↓
Dashboard
 ↓
Portfolio
 ↓
Positions
 ↓
Transactions
 ↓
Analytics
 ↓
Realtime
 ↓
Background operations
 ↓
Demo controls
```

Shared components should be extracted when repetition is demonstrated, not merely anticipated.

---

## 28. State Management Strategy

Use the smallest appropriate state scope.

### Server state

TanStack Query:

- portfolios
- positions
- transactions
- analytics
- API responses

### Client/global state

Zustand only when state genuinely spans features:

- UI preferences
- demo controls
- realtime connection state where justified

### Local state

React state for:

- form state
- dialogs
- temporary UI interactions
- local controls

Avoid putting server state into Zustand without a clear reason.

---

## 29. Form Strategy

Use:

```text
React Hook Form
+
Zod
```

for structured forms.

Validation should exist at multiple boundaries:

```text
UI validation
      ↓
API validation
      ↓
Domain invariants
```

Frontend validation improves UX.

Backend/domain validation protects correctness.

---

## 30. Error Handling Strategy

Errors should be designed by category:

```text
Validation
Authentication
Authorization
Not Found
Conflict
Rate Limit
Dependency Failure
Internal Error
Network Failure
Realtime Failure
Background Job Failure
```

Each category should have appropriate:

- backend representation
- frontend behavior
- logging behavior
- user-facing message

---

## 31. Realtime Implementation Strategy

Realtime should not become a second application architecture.

Use:

```text
Domain event
 ↓
Application event
 ↓
Realtime adapter
 ↓
WebSocket
 ↓
Frontend event handler
```

The UI should react to meaningful state changes rather than infrastructure details whenever possible.

---

## 32. Performance Measurement Strategy

Performance work should follow:

```text
Hypothesis
 ↓
Measurement
 ↓
Diagnosis
 ↓
Change
 ↓
Measurement
 ↓
Comparison
```

Do not add claims such as:

- “sub-100ms”
- “95+ Lighthouse”
- “40% faster”

unless measured and documented.

---

## 33. Security Validation Strategy

Before completion, review:

```text
Authentication
Authorization
Input validation
CORS
Secrets
Rate limiting
Resource limits
Error exposure
File handling
Dependency security
```

Security is an architectural property, not only a final checklist.

---

## 34. Accessibility Validation Strategy

Every primary flow should be tested for:

- keyboard navigation
- focus management
- labels
- semantic controls
- error association
- modal behavior
- table interaction
- reduced motion

Automated accessibility testing should complement manual inspection.

---

## 35. Demo Validation Strategy

Demo Mode must be tested independently from real infrastructure.

Required scenarios:

```text
normal flow
slow network
API failure
realtime disconnect
reconnect
background job failure
background job timeout
empty state
reset
persistence
```

The demo must remain coherent after each scenario.

---

## 36. Observability Validation Strategy

Verify that developers can identify:

### Request problem

```text
request ID
→ structured log
→ error
```

### Database problem

```text
health/readiness
→ dependency error
→ diagnostic log
```

### Realtime problem

```text
connection ID
→ lifecycle event
→ reconnect
```

### Background problem

```text
job ID
→ progress
→ failure/timeout
```

---

## 37. Deployment Validation Strategy

Test from a clean environment:

```text
checkout
 ↓
install
 ↓
build
 ↓
database
 ↓
migrate
 ↓
seed
 ↓
start
 ↓
health
 ↓
smoke
```

The system should not depend on hidden developer-machine state.

---

## 38. Git Workflow

Use small, coherent commits.

Recommended prefixes:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

Examples:

```text
feat: add portfolio repository
feat: implement transaction creation
test: cover transaction invariants
fix: handle websocket reconnect state
docs: document local deployment
```

Avoid enormous commits containing unrelated systems.

---

## 39. Feature Completion

A feature is not complete when its UI exists.

When applicable, completion should include:

```text
Domain
API
Persistence
UI
Validation
Error states
Loading states
Authorization
Tests
Observability
Documentation
```

Omissions must be intentional.

---

## 40. Technical Completion

The project is technically complete when:

- core domain is implemented
- backend is functional
- frontend is functional
- authentication works
- RBAC works
- PostgreSQL persists data
- REST API works
- WebSockets work
- background operations work
- Demo Mode works
- tests cover primary flows
- observability is available
- deployment is reproducible
- documentation is sufficient

---

## 41. Product Completion

The product is product-complete when a user can:

```text
sign in
 ↓
view dashboard
 ↓
manage portfolio
 ↓
inspect positions
 ↓
record transactions
 ↓
review analytics
 ↓
experience realtime updates
 ↓
receive operation feedback
```

with coherent loading, empty, success, and failure states.

---

## 42. Portfolio Completion

The portfolio project is complete when a reviewer can:

1. understand the problem quickly
2. enter the functional demo
3. understand the product
4. inspect the architecture
5. inspect the repository
6. understand key engineering decisions
7. verify meaningful implementation
8. understand tradeoffs
9. see testing and quality practices
10. understand how the system could evolve

---

## 43. Technical Interview Readiness

Prepare concise explanations for:

### Architecture

Why feature/domain-oriented architecture?

### Database

Why PostgreSQL?

### API

Why REST and where are contracts enforced?

### State

Why TanStack Query + Zustand?

### Tables

Why TanStack Table?

### Realtime

Why WebSockets?

### Demo

Why mock adapters instead of a static prototype?

### Authentication

Why JWT + RBAC?

### Deployment

Why Docker and a simple deployment topology?

### Testing

Why multiple test layers?

### Scalability

What changes when the system grows?

---

## 44. Architecture Decision Review

Before final case-study publication, review major decisions using:

```text
Problem
Decision
Alternatives
Reason
Tradeoffs
Evidence
Future evolution
```

Candidate decisions include:

- PostgreSQL
- REST
- WebSockets
- Zustand
- TanStack Query
- TanStack Table
- Docker
- mock adapters
- JWT
- RBAC

---

## 45. Avoiding Overengineering

Do not introduce technologies only because they appear in modern stacks.

Avoid premature introduction of:

- Kubernetes
- microservices
- Kafka
- Redis
- GraphQL
- event sourcing
- CQRS
- service mesh
- complex cloud orchestration

unless implementation discovers a real requirement.

The project should demonstrate engineering judgment by knowing what **not** to build.

---

## 46. Scalability Demonstration

Scalability should be demonstrated through boundaries.

Examples:

```text
Repository interface
→ database replacement

Realtime adapter
→ shared broker later

Background operation abstraction
→ dedicated worker later

Infrastructure adapter
→ external provider later
```

This is stronger than claiming that the initial system is infinitely scalable.

---

## 47. Performance Demonstration

Performance should be demonstrated through:

- measurement
- profiling
- efficient data fetching
- pagination
- caching where justified
- bounded realtime history
- controlled renders
- appropriate payload sizes

Optimize observed bottlenecks, not hypothetical ones.

---

## 48. Security Demonstration

Security should be visible through implementation evidence:

```text
JWT
RBAC
validation
CORS
rate limits
resource limits
secret management
safe errors
```

Do not present security features as complete until they have actually been implemented and validated.

---

## 49. Developer Experience

The repository should aim for:

```text
clone
 ↓
install
 ↓
configure
 ↓
docker compose
 ↓
migrate
 ↓
seed
 ↓
run
```

Documentation should cover:

- prerequisites
- commands
- environment variables
- database reset
- tests
- build
- deployment
- troubleshooting

---

## 50. Documentation Strategy

Maintain documentation during implementation.

Recommended categories:

```text
README
Architecture
API
Development
Testing
Demo
Deployment
Troubleshooting
Case Study
```

Actual implementation details override assumptions in the SDDs when implementation reveals a better solution.

Meaningful deviations should be documented.

---

## 51. SDD Change Management

The SDDs describe the target architecture, but they are not immutable.

If implementation requires a meaningful deviation:

```text
Identify discrepancy
 ↓
Evaluate impact
 ↓
Update relevant SDD
 ↓
Document decision
 ↓
Implement
```

Do not silently diverge from the documented architecture.

---

## 52. Milestone 1 — Foundation

Complete:

- repository
- TypeScript
- tooling
- Docker
- PostgreSQL
- migrations
- domain foundation

### Exit Criteria

```text
clean setup works
database works
domain tests work
```

---

## 53. Milestone 2 — Backend Core

Complete:

- Express
- configuration
- repositories
- API foundation
- health
- logging
- authentication
- RBAC

### Exit Criteria

```text
authenticated API
+
database persistence
+
observable runtime
```

---

## 54. Milestone 3 — Functional Product

Complete:

- frontend shell
- authentication UI
- dashboard
- portfolios
- positions
- transactions
- analytics

### Exit Criteria

```text
primary user workflow works end-to-end
```

---

## 55. Milestone 4 — Realtime and Operations

Complete:

- WebSockets
- reconnect
- realtime updates
- background jobs
- progress UI
- notifications

### Exit Criteria

```text
realtime + long-running operations
work reliably with failure states
```

---

## 56. Milestone 5 — Demo

Complete:

- mock adapters
- deterministic data
- persistence
- simulated latency
- failure injection
- realtime simulation
- reset

### Exit Criteria

```text
public demo works without production infrastructure
```

---

## 57. Milestone 6 — Quality

Complete:

- unit tests
- integration tests
- component tests
- E2E
- accessibility
- security review
- performance measurement

### Exit Criteria

```text
primary product and recovery flows are tested
```

---

## 58. Milestone 7 — Deployment

Complete:

- production builds
- Docker
- environment configuration
- deployment
- health
- smoke tests
- deployment documentation

### Exit Criteria

```text
clean production-like deployment is reproducible
```

---

## 59. Milestone 8 — Portfolio

Complete:

- project page
- architecture visualization
- technical decisions
- implementation highlights
- demo link
- repository link
- screenshots
- measured outcomes
- lessons learned

### Exit Criteria

```text
project communicates engineering ability
without unsupported claims
```

---

## 60. Final Repository Validation

Run from a clean environment:

```text
Install
Lint
Type check
Unit tests
Integration tests
Build
E2E
Docker build
Docker startup
Migrations
Seed
Health checks
Smoke tests
```

Every failure should be resolved or explicitly documented.

---

## 61. Final Quality Gate

### Product

- Does the product solve the defined problem?
- Are primary flows coherent?

### UX

- Is the interface understandable?
- Are failures communicated well?

### Architecture

- Are responsibilities separated?
- Can infrastructure be replaced?

### Backend

- Are domain rules centralized?
- Are APIs validated?

### Frontend

- Is server state separated from UI state?
- Are components maintainable?

### Realtime

- Does reconnect work?
- Are updates efficient?

### Security

- Are authorization boundaries enforced?

### Testing

- Do tests verify behavior?

### Observability

- Can failures be diagnosed?

### Deployment

- Can another developer reproduce the environment?

### Demo

- Does the demo prove the architecture?

### Portfolio

- Are all claims supported by evidence?

---

## 62. What Must Not Be Done

The following are explicitly prohibited unless later justified:

- fabricate performance metrics
- fabricate users or business outcomes
- claim production scale that does not exist
- present mock infrastructure as real infrastructure
- expose private credentials
- rely on paid APIs for the core demo
- build static-only demo flows
- duplicate domain rules across frontend/backend
- add technologies only for resume keywords
- hide architectural tradeoffs
- postpone all testing until the end
- postpone all documentation until the end

---

## 63. Final Implementation Sequence

The recommended execution sequence is:

```text
01. Repository
02. Tooling
03. Docker
04. PostgreSQL
05. Migrations
06. Domain model
07. Repository layer
08. Express/API foundation
09. Observability foundation
10. Authentication
11. RBAC
12. Frontend shell
13. Auth UI
14. Dashboard
15. Portfolio
16. Positions
17. Transactions
18. Analytics
19. Tables/filters
20. Realtime
21. Background operations
22. Notifications
23. Demo adapters
24. Demo simulations
25. Unit/integration/component tests
26. E2E tests
27. Accessibility validation
28. Security review
29. Performance measurement
30. Production build
31. Deployment
32. Smoke tests
33. Documentation
34. Case study
35. Interview preparation
```

This sequence should be adjusted when real implementation dependencies reveal a better order.

---

## 64. Final Architecture Validation

At the end of implementation, verify that the conceptual architecture remains:

```text
                    PRESENTATION
                         │
                         ▼
                      FEATURES
                         │
                         ▼
                    APPLICATION
                         │
                         ▼
                       DOMAIN
                         │
                         ▼
                   INFRASTRUCTURE
                         │
             ┌───────────┼───────────┐
             │           │           │
          PostgreSQL   WebSocket   External APIs
```

For Demo Mode:

```text
                    PRESENTATION
                         │
                         ▼
                      FEATURES
                         │
                         ▼
                    APPLICATION
                         │
                         ▼
                       DOMAIN
                         │
                         ▼
                  MOCK INFRASTRUCTURE
                         │
             ┌───────────┼───────────┐
             │           │           │
          Mock DB     Mock API    Simulated WS
```

The product/application layer remains shared.

---

## 65. Final Project Principle

The complete project should communicate:

> **The system is designed so that complexity can evolve without forcing the product to become fragile.**

The portfolio should demonstrate:

- deliberate boundaries
- explicit tradeoffs
- coherent domain modeling
- maintainable frontend architecture
- reliable backend architecture
- secure access control
- realtime capability
- realistic failure handling
- testability
- observability
- deployment awareness
- infrastructure substitution
- thoughtful UX

---

## 66. Final Definition of Done

### Product

- [ ] primary workflows are functional
- [ ] portfolio management works
- [ ] positions are represented correctly
- [ ] transactions work
- [ ] analytics are coherent
- [ ] realtime behavior is meaningful

### Architecture

- [ ] application layers are separated
- [ ] domain rules are isolated
- [ ] infrastructure uses adapters
- [ ] Demo Mode uses infrastructure substitution
- [ ] major boundaries are documented

### Frontend

- [ ] React + TypeScript application works
- [ ] routing works
- [ ] TanStack Query is used appropriately
- [ ] Zustand is used only where justified
- [ ] TanStack Table supports complex data
- [ ] forms use appropriate validation
- [ ] loading/error/empty states exist
- [ ] responsive behavior is validated

### Backend

- [ ] Node.js + TypeScript API works
- [ ] REST contracts are implemented
- [ ] PostgreSQL persistence works
- [ ] authentication works
- [ ] RBAC works
- [ ] validation works
- [ ] error handling works
- [ ] health checks work

### Realtime

- [ ] WebSocket connection works
- [ ] events are typed
- [ ] reconnect works
- [ ] resynchronization is handled
- [ ] simulated realtime works in Demo Mode

### Operations

- [ ] background jobs work
- [ ] progress is visible
- [ ] failures are handled
- [ ] cancellation/timeout behavior is implemented where applicable

### Testing

- [ ] unit tests exist
- [ ] integration tests exist
- [ ] component tests exist where valuable
- [ ] E2E tests cover critical flows
- [ ] Demo Mode scenarios are tested

### Security

- [ ] secrets are protected
- [ ] authorization is server-side
- [ ] inputs are validated
- [ ] CORS is configured
- [ ] resource limits exist
- [ ] sensitive errors are not exposed

### Observability

- [ ] structured logs exist
- [ ] request IDs exist
- [ ] health/readiness exist
- [ ] errors are diagnosable
- [ ] realtime lifecycle can be inspected
- [ ] background operations can be diagnosed

### Deployment

- [ ] Docker setup works
- [ ] production builds work
- [ ] migrations work
- [ ] environment configuration is documented
- [ ] deployment is reproducible
- [ ] smoke tests work

### Demo

- [ ] no paid infrastructure is required
- [ ] demo is functional
- [ ] realistic loading exists
- [ ] failures can be simulated
- [ ] realtime simulation works
- [ ] demo can reset safely

### Portfolio

- [ ] case study reflects actual implementation
- [ ] architecture is visualized
- [ ] tradeoffs are documented
- [ ] measured outcomes are real
- [ ] unsupported metrics are removed
- [ ] repository is understandable
- [ ] demo is accessible
- [ ] technical interview walkthrough is prepared

---

## 67. Closing Principle

The implementation should not be judged by how many features or technologies it contains.

It should be judged by whether the final system demonstrates that its author can:

```text
understand a product problem
        ↓
design a solution
        ↓
define architecture
        ↓
implement it
        ↓
handle failure
        ↓
test it
        ↓
observe it
        ↓
deploy it
        ↓
explain the tradeoffs
```

That is the intended outcome of the Trading Analytics Platform project.

> **The implementation is the evidence. The architecture is the reasoning. The product is the result.**
