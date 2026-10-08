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

**Status:** per item (table below); the backend endpoints are `Implemented` and every screen is frontend stage work

**Owning blocks:** Backend: none for the endpoints themselves (B0 adds the archived-portfolio guard and route tests; B5 changes asset price semantics); Frontend: FE1 (§4.3), on top of FE0.

| Deliverable | Status | Block |
| --- | --- | --- |
| Portfolio endpoints: list, create, get by id, update (`PATCH`) and archive (`apps/api/src/routes/portfolios.routes.ts`) | `Implemented` | none |
| Position endpoints: list and get by id (`positions.routes.ts`) | `Implemented` | none |
| Overview endpoint with the Pulse (`overview.routes.ts`, `GET /api/v1/portfolios/:portfolioId/overview`) | `Implemented`; the period `performance` field `Planned (B1)` (`07-api-spec.md` §11) | B1 |
| Asset endpoints: list, detail, price and history (`assets.routes.ts`), and the batch price endpoint (`market.routes.ts`) | `Implemented`; change semantics against the last closed candle `Planned (B5)` (ADR-007 point 14) | B5 |
| Archived portfolio is read-only: any mutation scoped to it returns 409 `CONFLICT` and writes nothing; reads and the archive call are unchanged (ADR-010 point 5). A delete on an archived portfolio, such as deleting one of its alerts, is a mutation and returns 409 too | `Planned (B0)` | B0 |
| Route tests for the positions, assets, market and analytics routes, before the services move into `@trading/application` (ADR-001 point 8) | `Planned (B0)` | B0 |
| Session state: the access token kept in memory only (ADR-005 point 4), login and logout screens | `Planned (FE1)`; session endpoints `Planned (B2)` | FE1 |
| Dashboard, portfolio listing, portfolio detail and positions screens, navigation | `Planned (FE1)`; the application shell is FE0 (§10) | FE1 |
| Loading, empty and error states; responsive behavior (breakpoints 900 px and 560 px, minimum width 360 px, ADR-010 point 9) | `Planned (FE1)` | FE1 |
| API integration through the `TradingClient` port and its HTTP adapter over `@trading/contracts` (ADR-002 point 5) | `Planned (FE0)` for the client; `Planned (FE1)` for its use in each screen | FE0, FE1 |

Code vs ADR:

- The archived-portfolio guard does not exist. Archiving is idempotent and never 409 (`portfolio.service.ts`, `alreadyArchived` in the response meta), `PATCH` on an archived portfolio is accepted, and `createTransaction` only checks that the portfolio belongs to the caller. ADR-010 point 5 makes the portfolio read-only after archive. Hard deletion and unarchiving are `Deferred` (FR-011).
- The original objective calls this "the first complete vertical product slice". Under the backend-first override (§4.1) the slice is delivered inside FE1 over a finished backend, not as the first slice of the project. The acceptance criterion stays: a user completes the primary workflow against the real backend, in real mode. The same workflow in the demo is FE4 (§16).
- Authentication state and the session screens belong to Phase 4 (§9) and are listed here only because the workflow starts with login.
- The overview, positions, assets and market routes have no route test file today. ADR-001 point 8 lists analytics, positions, assets and market for B0 and does not list the overview, which has no route test either.

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

**Status:** per item (table below)

**Owning blocks:** Backend: B0 (chronological validation, position projection and isolation, archived guard, `Clock` port), B1 (fees, currency check), B2 (role checks), B4 (`Idempotency-Key`), B5 (`PORTFOLIO_UPDATED`); Frontend: FE1.

| Deliverable | Status | Block |
| --- | --- | --- |
| Transaction endpoints: list with filters (`assetId`, `type`, `dateFrom`, `dateTo`, `page`, `pageSize`), get by id and create (`apps/api/src/routes/transactions.routes.ts`) | `Implemented` | none |
| Creation is synchronous: the transaction, its position recalculation and its `COMPLETED` status commit in one `UnitOfWork` (`transaction.service.ts`, `PrismaUnitOfWork`); a failure rolls the whole unit back | `Implemented` | none |
| Position projection: `calculatePositionAfterTransaction` upserts the position, or deletes it when a `SELL` closes it exactly | `Implemented` (incremental, from the current row) | none |
| Validation today: `BUY` or `SELL`, `quantity > 0`, `price > 0`, `fees ≥ 0`, fee currency equals price currency, `executedAt` not in the future, unknown `assetId` is 404, `SELL` above the held quantity is 400 | `Implemented` (FR-018) | none |
| Current time from the `Clock` port instead of `new Date()` in `validateNewTransaction` (ADR-001 point 8) | `Planned (B0)` | B0 |
| Chronological validation: the holding stays non-negative at `executedAt` and after every later transaction in date order; backdating is allowed; the same `executedAt` is ordered by creation order (ADR-003 point 6 and Deferred detail) | `Planned (B0)` | B0 |
| Position projection rebuilt by replaying the asset's transactions in date order, so a backdated transaction gives the right `averageEntryPrice` and `openedAt` (`05-data-model.md` §8 Open detail) | `Planned (B0)` | B0 |
| Position isolation under concurrency: two concurrent `SELL 6` on a holding of 10, exactly one succeeds (ADR-001 Deferred detail, FR-017) | `Planned (B0)` | B0 |
| Archived portfolio: creating a transaction returns 409 `CONFLICT` and writes nothing (ADR-010 point 5) | `Planned (B0)` | B0 |
| `BUY` fees in the cost basis (`averageEntryPrice` becomes `(held × average + quantity × price + fees) / (held + quantity)`) and `SELL` fees subtracted from realized P/L (ADR-004 point 15) | `Planned (B1)` | B1 |
| A `SELL` with `fees > quantity × price` is rejected with 400; fees equal to the gross proceeds are accepted (ADR-004 point 2) | `Planned (B1)` | B1 |
| An asset whose currency differs from the portfolio's `baseCurrency` is rejected with 400, never 500 (ADR-004 point 12) | `Planned (B1)` | B1 |
| Role check on create: a `VIEWER` is denied (ADR-005) | `Planned (B2)` | B2 |
| Duplicate prevention: `Idempotency-Key` on `POST .../transactions`; a repeated key and request returns the stored response, a different request returns 409 (ADR-008 point 8) | `Planned (B4)` | B4 |
| `PORTFOLIO_UPDATED` emitted after the commit (ADR-007 point 6) | `Planned (B5)` | B5 |
| Edit, delete and cancel of a transaction | No endpoint in version 1: transactions are immutable except for `status` (ADR-003 point 7, `05-data-model.md` §43, `07-api-spec.md` §13) | none |
| Screens: transaction form, transaction history with the FR-016 filters, positions, derived values (market value, unrealized P/L) and user feedback; submit disabled while pending and dependent views updated without reload (FR-017, FR-077) | `Planned (FE1)` | FE1 |

Code vs ADR:

- The original task list includes "edit transaction where permitted" and "delete/cancel where permitted". The API has no update or delete route (`transactions.routes.ts`), `07-api-spec.md` §13 and ADR-003 point 7 state that transactions are immutable, and no FR asks for either action. The tasks stay below as the original intent, not as scope.
- "Conflict handling" has two sources in version 1: 409 `CONFLICT` on an archived portfolio (B0) and on a repeated `Idempotency-Key` with a different request (B4). Overselling stays a 400 validation error.
- Nothing checks the order of transactions today: a `SELL` dated before an earlier `BUY` passes when the current position is large enough, and the position is rebuilt only from the current row. ADR-003 point 6 and `05-data-model.md` §8 put both fixes in B0.
- The fee handling change is visible in the code as well: `position-recalculation.ts` ignores `fees`, so `averageEntryPrice` excludes the `BUY` fees and unrealized P/L is higher than ADR-004 point 15 will report.
- `05-data-model.md` §8 Open detail and §45 put the concurrent read-modify-write of the position in B7. ADR-001 Deferred detail and FR-017 put it in B0, and the ADR precedes (see `BACKEND-ROADMAP.md` B7, T5.3).
- The "Important Principle" below holds and is stronger under ADR-001: business rules live in domain validators and, from B0, in `@trading/application`. Today they live in `apps/api/src/services/` and `packages/domain`. React holds none, and the demo runs the same use cases in process (§16).

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

**Status:** per item (table below)

**Owning blocks:** Backend: B1 (performance, risk, range attribution, Pulse inputs, realized P/L, What Changed); Frontend: FE2 (§4.3), after FE1. Formulas, edge cases and hand-computed examples are in `16-analytics-spec.md`; the methodology is ADR-004.

| Deliverable | Status | Block |
| --- | --- | --- |
| Allocation: `GET /api/v1/portfolios/:portfolioId/analytics/allocation`, `groupBy` = `asset`, `assetType` or `currency` (`analytics.routes.ts`); sector is `Deferred` (ADR-004 point 13) | `Implemented` | none |
| Attribution, current state: each position's contribution to unrealized P/L, no query parameters (`GET .../analytics/attribution`) | `Implemented` | none |
| Attribution over a range: `period` or `from` / `to`, `groupBy` = `asset` or `assetType`, contributions in `Money` summing exactly to the period P/L (ADR-004 point 10) | `Planned (B1)` | B1 |
| Performance: `GET .../analytics/performance`, periods `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, `YTD`, `ALL` or a custom `from` / `to` (default `1M`); TWR in `twrPercent`, `pnl` in `Money`, `series`, `asOf`, `effectiveFrom` and `status` (`OK`, `INSUFFICIENT_DATA`, `UNKNOWN`); unavailable values are `null`, never `0` (ADR-004 points 1 to 7, ADR-002 point 10) | `Planned (B1)`; `1D` `Implemented` as `dailyChange` in the overview | B1 |
| Risk: `GET .../analytics/risk`, volatility annualized with √365 (at least 20 daily returns) and drawdown on the cumulative return index (at least 2 index points), with peak and trough dates (ADR-004 points 8 and 9) | `Planned (B1)` | B1 |
| Pulse: stays inside the overview; volatility and drawdown come from the portfolio series over a trailing `1Y` window, volatility `HIGH` above 60 and `MODERATE` above 20 (ADR-004 point 11) | `Implemented` with the largest-position proxy; portfolio-series inputs `Planned (B1)`; a standalone endpoint, exposure and an `overall` classification `Deferred` | B1 |
| Realized P/L reported per `SELL`, after fees (ADR-003 point 4, ADR-004 point 15) | `Planned (B1)` | B1 |
| What Changed (FR-006): largest contributor and detractor, positions opened and closed, alerts triggered, over the same period as performance (ADR-010 point 1); "significant value change", "unusual volatility" and "allocation changes" | `Planned (B1)`; the three thresholded types `Deferred` | B1 |
| Returns, ratios and percentages computed in `Decimal` end to end and converted to a number only in the presenter; day boundaries are UTC calendar dates (ADR-004 points 14 and Deferred detail) | `Planned (B1)` | B1 |
| Analytics tests against hand-computed examples (ADR-004 Consequences, the examples in `16-analytics-spec.md`) | `Planned (B1)` | B1 |
| Transaction filters (`assetId`, `type`, `dateFrom`, `dateTo`) and pagination for assets and transactions (FR-014, FR-016, FR-056) | `Implemented` | none |
| Transaction search (FR-015): satisfied by the FR-016 filters and the asset search of FR-020; no free-text transaction search (ADR-010 point 2) | Satisfied by filters | none |
| Sorting in the client, only for lists loaded in full (positions, watchlist, allocation, scenarios); paginated lists keep the API order; server-side sort parameters `Deferred` (ADR-010 point 4, FR-055) | `Planned (FE2)` | FE2 |
| Table library (the original TanStack Table) | `Deferred` to the frontend-stage ADR (`04-tech-stack.md` §12) | FE2 |
| Configurable columns and row selection (the original "column visibility") | `Deferred` (ADR-010 point 9) | none |
| Table screens for transactions, positions and portfolio datasets: pagination controls over the API `meta`, loading, empty and error states, responsive behavior | `Planned (FE2)` | FE2 |
| Analytics views (performance, risk, Pulse, allocation, attribution) and charts; money and percentage display rules and the UTC calendar-day display (ADR-010 point 9); chart library | `Planned (FE2)`; chart library `Deferred` to the frontend-stage ADR (`04-tech-stack.md` §16) | FE2 |

Code vs ADR:

- The original text names TanStack Table and lists "sorting, filtering, pagination, column visibility" as features. No ADR decides the table library. Filtering is the API filters of FR-016, pagination comes from the API only for assets and transactions, sorting is client-side only for fully loaded lists, and configurable columns are `Deferred`. The list is kept as the original intent, not as a decision.
- The original category list names win/loss statistics, exposure and transaction statistics. No FR or ADR defines win/loss or transaction statistics, and exposure is `Deferred` (`01-product-spec.md` §5 and §11, `07-api-spec.md` §21). The phase rule "implement only metrics defined by the product specification" therefore leaves them out until an FR defines them. Decided (ADR-010 point 10, approved by the user on 2026-10-07): win/loss and transaction statistics are not part of version 1.
- The code has no portfolio-level performance, volatility or drawdown. `calculateVolatility` and `calculateDrawdown` work on one asset's closes, and volatility annualizes with √252 only when asked. ADR-004 point 8 changes this to a return series, √365 and a 20-return minimum (B1).
- Wire details that ADR-004 and ADR-002 fix and that the original text does not: the period return is the field `twrPercent` (`16-analytics-spec.md` §2), `asOf` is the end date after clamping to the last closed day, a valid range with no closed day answers 200 with `status: "INSUFFICIENT_DATA"` and not 400 (`16-analytics-spec.md` §8), and `from > to` is 400. `InsufficientData` is a domain error in `16-analytics-spec.md` and `INSUFFICIENT_DATA` is its wire status.
- Mixed currencies in a portfolio surface as a 500 in allocation today (`CurrencyMismatchError`); the 400 on the transaction that would create them is `Planned (B1)` (ADR-004 point 12, `16-analytics-spec.md` §2).
- Period analytics cover closed days only and do not change on price ticks (FR-045). Current-state values (allocation, Pulse, `1D`) are recomputed in the client on ticks in FE3 (§14).
- FR-015 needs no work in this phase beyond the FR-016 filters and the asset search (ADR-010 point 2).

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

**Status:** per item (table below); nothing in this phase exists in the code yet

**Owning blocks:** Backend: B5 (transport, protocol, simulation engine, control endpoints), with inputs from B0 (`@trading/contracts`, `Clock` port), B2 (token refresh, `simulation:control`) and B4 (job events); Frontend: FE3 (client), FE4 (in-process adapter for the demo). Decisions: ADR-007.

| Deliverable | Status | Block |
| --- | --- | --- |
| WebSocket server with `ws` behind a transport port, served by the same HTTP server and port (7001) as the API on a fixed path, proposed `/ws` and confirmed in B5; there is no `WEBSOCKET_PATH` variable (ADR-007 point 1) | `Planned (B5)`; the path is an open detail | B5 |
| Authentication: the access token in the first message, never in the URL; a connection not authenticated within 5 seconds is closed with `4001`; each socket is bound to its token's expiry and re-authenticates over the same socket after a refresh (ADR-007 point 2) | `Planned (B5)`; refresh itself `Planned (B2)` | B5 |
| Channels `market:{assetId}`, `portfolio:{portfolioId}` and `notifications`, each subscription authorized in the application layer by permission and ownership (ADR-007 point 3); `jobs:{jobId}` for the job events of ADR-008 point 11 | `Planned (B5)` | B5 |
| Envelope `{ id, type, channel, sequence, timestamp, payload }` and the event catalog `MARKET_PRICE_UPDATED`, `PORTFOLIO_UPDATED`, `NOTIFICATION_CREATED`, `ALERT_TRIGGERED` (delivered on `notifications`), as Zod schemas in `@trading/contracts` (ADR-007 points 4, 6, 15); job events `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED`, `JOB_FAILED` | `Planned (B5)`; the package `Planned (B0)` | B5 |
| Protocol messages `AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE`, with `ACK` or `ERROR` (carrying a `code`) as replies; event validation at the boundary (ADR-007 point 15) | `Planned (B5)` | B5 |
| Close codes: `4001` unauthenticated or invalid token, `4002` token expired, `4008` limit exceeded, `1001` server going away (ADR-007 point 15) | `Planned (B5)` | B5 |
| Limits: 50 subscriptions and 20 inbound messages per second per connection, 1 MB outbound buffer, ping every 30 seconds with close after 2 missed pongs (ADR-007 points 11, 15) | `Planned (B5)` | B5 |
| Per-user cap of 5 concurrent connections (not per IP); when a user is at the cap, the new connection is closed with `4008` and the existing ones stay open (ADR-007 point 16, ADR-005 point 13) | `Planned (B5)`; the value is tuned in B5 | B5 |
| Ordering: `sequence` monotonic per channel; on a gap the client resynchronizes through HTTP; no server replay buffer (ADR-007 point 5) | `Planned (B5)` for the sequence; resynchronization `Planned (FE3)` | B5, FE3 |
| Simulation engine and persistence: tick every second, `MarketPrice` update and `MarketEvent` append, daily candle closing and startup backfill, edge-triggered alerts (ADR-007 points 7 to 9). The package is `@trading/market-sim` (§16) | `Planned (B5)` | B5 |
| Control endpoints `POST /api/v1/simulation/start`, `POST /api/v1/simulation/pause` and `PUT /api/v1/simulation/mode`, requiring `simulation:control` (`ADMIN`) (ADR-007 points 10, 15) | `Planned (B5)`; the permission `Planned (B2)` | B5 |
| Lifecycle state `RUNNING <-> HALTED`; `PAUSED` stays only as a mode wire identifier (ADR-007 point 16) | `Planned (B5)` | B5 |
| Client connection manager with the states `Connected`, `Connecting`, `Reconnecting`, `Disconnected` and `Failed`; reconnection that authenticates first, resubscribes and resynchronizes through HTTP (FR-046, FR-047) | `Planned (FE3)` | FE3 |
| UI update strategy: the client recomputes position value, unrealized P/L, portfolio value, `1D` change, allocation and Pulse from price events with the shared domain functions; the server pushes no valuations (FR-045, ADR-007 context) | `Planned (FE3)` | FE3 |
| Degradation: a stale-data indicator and an HTTP refetch every 10 seconds while the socket is down (ADR-007 points 12, 15); cleanup of subscriptions and timers on unmount | `Planned (FE3)` | FE3 |
| In-process realtime adapter implementing the same client-side port, fed by `@trading/market-sim` in the browser (ADR-007 point 13) | `Planned (FE4)` | FE4 |
| Performance validation of the transport | Open: no ADR or NFR fixes a target; measured before it is optimized (§3 rule 1) | B5, FE3 |

Code vs ADR:

- The code has no WebSocket server, no `ws` dependency, no simulator and no `packages/market-sim`. `MarketPrice`, `MarketEvent` and `HistoricalPrice` exist as tables, and prices change only through the seed.
- The task "market simulation" is split: the engine and its control are B5, the browser side of it is the demo adapter (FE4), and the client UI strategy is FE3. The recommended order below stays valid inside B5: the transport is stable before the simulation grows.
- The recommended order puts "authentication" as its own step after the connection. ADR-007 point 2 makes it the first message of the connection, with a 5-second deadline, and the token is re-validated on every re-authentication.
- `08-realtime-spec.md` §15 listed eleven event types. ADR-007 point 6 keeps four, and `TRANSACTION_CREATED`, `TRANSACTION_COMPLETED` and `POSITION_UPDATED` are removed because transactions are synchronous.
- `PAUSED` names two things in the older documents: a lifecycle state and a mode. ADR-007 point 16 renames the state to `HALTED` and keeps `PAUSED` as a mode wire identifier only. The `pause` endpoint path does not change.
- Job events travel on `jobs:{jobId}` and are produced by the job runner of B4 (§15). They reach the client when the transport exists in B5.
- Real mode has no stop and no seed reset; reset belongs to the frontend-stage demo ADR (ADR-007 point 15, ADR-010 point 6).
- Realtime depends on B2 for two things: `simulation:control` and the re-authentication that follows a token refresh. A socket cannot be bound to a refreshed token before B2 exists.

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

**Status:** per item (table below); nothing in this phase exists in the code yet

**Owning blocks:** Backend: B4 (jobs, idempotency), with B0 (archived guard, chronological validation reused by the import rows), B2 (`transaction:create`) and B5 (job events over the socket); Frontend: FE3 (import screens and job progress), FE4 (in-process runner for the demo). Decisions: ADR-008.

| Deliverable | Status | Block |
| --- | --- | --- |
| Scope: the only background operation of version 1 is the CSV transaction import (ADR-008 point 1); transactions stay synchronous (point 12) | `Planned (B4)` | B4 |
| `Job` and `IdempotencyKey` models and migrations (`05-data-model.md` §52 and §53) | `Planned (B4)` | B4 |
| In-process runner backed by a `jobs` table in PostgreSQL, with no separate worker and no external queue; the CSV content is stored in the job row when the job is created; the stored input is kept while the job can be retried and cleared for `COMPLETED` jobs and for jobs that `FAILED` with `VALIDATION_FAILED` (ADR-008 point 4) | `Planned (B4)` | B4 |
| States `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`; progress is the field `{ processed, total }`, not a state (ADR-008 point 3) | `Planned (B4)` | B4 |
| Two stages: validate every row (a failure ends `FAILED` with `VALIDATION_FAILED`, a per-row report and nothing written), then apply all rows in one `UnitOfWork` that re-checks the invariants (`APPLY_REJECTED`, `APPLY_ERROR`); no partial import (ADR-008 point 2 and Deferred detail) | `Planned (B4)` | B4 |
| Endpoints `POST /api/v1/portfolios/:portfolioId/imports`, `GET /api/v1/jobs/:jobId`, `POST /api/v1/jobs/:jobId/retry` and `POST /api/v1/jobs/:jobId/cancel`, checked for permission and ownership (ADR-008 point 9) | `Planned (B4)`; the permission `Planned (B2)` | B4 |
| Retry returns a job to `QUEUED` and increments `attempt`; allowed for `TIMED_OUT`, `CANCELLED` and `FAILED` with `INTERRUPTED`, `APPLY_ERROR` or `APPLY_REJECTED`; not for `VALIDATION_FAILED`. Cancel is allowed while `QUEUED` or validating, never during apply. A retry or cancel that the state does not allow returns 409 `CONFLICT` and changes nothing (ADR-008 point 6) | `Planned (B4)` | B4 |
| Timeout per job type, measured per attempt from when the job was queued, applying while `QUEUED` or validating; the apply stage is exempt (ADR-008 point 7 and Deferred detail); the timeout values are fixed in B4 | `Planned (B4)` | B4 |
| Restart handling: a job left in `PROCESSING` becomes `FAILED` with `INTERRUPTED`, and every `QUEUED` job resumes; every status transition is a compare-and-set (ADR-008 points 5 and Deferred detail) | `Planned (B4)` | B4 |
| Notifications: `COMPLETED` creates a `SUCCESS` notification, `FAILED` and `TIMED_OUT` an `ERROR` notification, `CANCELLED` none (ADR-008 point 6, ADR-010 point 9) | `Planned (B4)` | B4 |
| `Idempotency-Key` on `POST .../transactions` and on import creation: stored per user with a request hash for 24 hours, same request returns the stored response, a different request returns 409 (ADR-008 point 8) | `Planned (B4)` | B4 |
| Input limits: file size and row count (values fixed in B4), a route-specific body limit because the global JSON limit is 100 kB, the way the CSV reaches the route, and the CSV parsing dependency (ADR-008 point 10 and Deferred detail) | `Planned (B4)`; values are open details | B4 |
| Archived portfolio: creating an import is rejected with 409; a job whose portfolio is archived while `QUEUED` or `PROCESSING` fails with a non-retryable error and writes nothing (ADR-010 point 5 and Deferred detail) | `Planned (B0)` for the guard, `Planned (B4)` for the job check | B0, B4 |
| Job events `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED`, `JOB_FAILED` on `jobs:{jobId}`; `CANCELLED` and `TIMED_OUT` emit no event and clients read them from the job's HTTP status (ADR-008 point 11, ADR-007 point 15) | `Planned (B5)`, with the transport | B5 |
| Screens: CSV upload, progress, current state, per-row errors, cancel and retry where the state allows them, completion feedback, and the imported transactions | `Planned (FE3)` | FE3 |
| Demo: the same use case runs in process with simulated progress and injectable import failures (ADR-008 point 13, FR-069, FR-071) | `Planned (FE4)`; other scripted failures `Deferred` (ADR-010 point 6) | FE4 |

Code vs ADR:

- The code has no `Job` or `IdempotencyKey` model (`packages/database/prisma/schema.prisma`), no CSV dependency and no job route.
- The original examples (analytics recalculation, report generation, file generation, expensive portfolio processing) are not jobs in version 1. ADR-008 point 1 scopes the job system to the CSV import, because building a job system with nothing to run violates NFR-070. No FR defines the other examples.
- The original state names are replaced: `queued` becomes `QUEUED`, `running` becomes `PROCESSING`, and `timeout` becomes `TIMED_OUT`. `completed`, `failed` and `cancelled` keep their meaning. `retrying` and `cancelling` (`12-demo-mode-spec.md` §41-43) are not states.
- "Cancellation where supported" is exactly `QUEUED` or the validate stage. The apply stage is neither cancellable nor subject to the timeout, so a retry can never import the same rows twice.
- "Resulting artifact/data" is the set of imported transactions and the per-row report of a failed validation. No file is generated.
- `07-api-spec.md` §14 once described asynchronous transaction creation with a `jobId`; ADR-008 point 12 removes it, and `createTransaction` stays synchronous.

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

**Status:** per item (table below); the demo is frontend stage work that reuses backend deliverables of B0 and B5

**Owning blocks:** Backend: B0 (`@trading/application`, in-memory `UnitOfWork`, `@trading/contracts`), B5 (`@trading/market-sim`); Frontend: FE4 (§4.3), after FE0. Decisions: ADR-001, ADR-002 point 5, ADR-005 point 11, ADR-006 points 1 and 7, ADR-007 points 7 and 13, ADR-008 point 13, ADR-010 point 6.

| Deliverable | Status | Block |
| --- | --- | --- |
| Application layer `@trading/application` that the demo runs in the browser, with in-memory implementations of the repository contracts and of `UnitOfWork` (rollback included) | `Planned (B0)`; the package does not exist yet | B0 |
| `@trading/contracts`: the DTOs and schemas both adapters return | `Planned (B0)` | B0 |
| `@trading/market-sim`: a pure, deterministic package with a seeded pseudo-random generator, an injected clock and the modes and scenarios of `12-demo-mode-spec.md` §37-§40; depends only on `@trading/domain`; the API and the demo use the same engine (ADR-007 point 7) | `Planned (B5)`; the package lives at `packages/market-sim` (ADR-007 point 7) | B5 |
| Runtime mode selection: `APP_MODE` is `real` or `demo`, fixed at build time through `VITE_APP_MODE` (ADR-006 point 8) | `Planned (FE0)` for the build-time values; `Planned (FE4)` for the demo build | FE0, FE4 |
| In-process adapter of the `TradingClient` port, calling `@trading/application` and the same presenters, so the UI cannot tell which mode it runs in (ADR-002 point 5); the HTTP adapter is FE0 | `Planned (FE4)` | FE4 |
| Demo composition root with in-memory repositories (ADR-001 point 4); the in-memory fakes written for the application tests are its starting point | `Planned (FE4)` | FE4 |
| Demo identity with a role selector (Viewer, Trader, Admin) that goes through the same permission checks (ADR-005 point 11) | `Planned (FE4)` | FE4 |
| Simulated realtime: the in-process realtime adapter fed by `@trading/market-sim` in the browser (ADR-007 point 13, FR-070) | `Planned (FE4)` | FE4 |
| Market modes and scenarios (`STABLE_MARKET`, `BULLISH_SESSION`, `VOLATILE_SESSION`, `SHARP_DRAWDOWN`, `RECOVERY`) and their demo controls (FR-048) | Engine `Planned (B5)`; controls `Planned (FE4)` | B5, FE4 |
| Background job simulation: the CSV import runs in process with simulated progress and injectable failures (ADR-008 point 13, FR-069, FR-071) | `Planned (FE4)` | FE4 |
| Validation errors and rejected operations (for example an oversell) through the real rules, without scripting (FR-071) | `Planned (FE4)` | FE4 |
| Static build of `apps/web` in demo mode: no call to any backend, no secrets in the build, namespaced browser storage, configurable base path, SPA fallback (ADR-006 point 7) and its publication | `Planned (FE4)` | FE4 |
| Demo data layers and the deterministic seed data, local persistence, reset (FR-072) | `Deferred` to the frontend-stage ADR (ADR-010 point 6) | FE4 |
| Simulated latency and scripted failures other than the import failure (request failure, timeout, connection loss) | `Deferred` to the frontend-stage ADR (ADR-010 point 6) | FE4 |
| Diagnostics | `Deferred` (`12-demo-mode-spec.md` §75; the same item in the Phase 13 row of §4.2) | FE4 |
| Demo hosting, the base path value, the SPA fallback mechanism and the numeric bound of the demo simulation | `Deferred` to the frontend-stage ADR (ADR-010 point 6, ADR-006 point 7) | FE4 |

Code vs ADR:

- The original task list says "mock repositories" and "mock services", and the objective asks for a demo that behaves like a product rather than a static prototype. ADR-001 rejects mocks at the HTTP client level: the demo runs the real application layer in the browser, and only the infrastructure differs (in-memory repositories, in-process realtime and job runner). There are no mock services, and `07-api-spec.md` §49 to §51 state that there is no mock API. In this document "mock" means an in-memory implementation of a real contract.
- The last line of the original acceptance criteria, "The same product/application behavior should remain conceptually shared with the real implementation", is made concrete by ADR-001 and ADR-002 point 5: one application layer, one set of DTOs, two adapters. Responses of the demo adapter are validated against the schemas during development (ADR-002 point 6).
- "Deterministic seed" has two meanings. The seeded pseudo-random generator of the market engine is decided (ADR-007 point 7, B5). The demo's initial data and its layers are not (ADR-010 point 6).
- "Local persistence" is not decided. Only the requirement that browser storage is namespaced is (ADR-006 point 7).
- "Failure injection" is decided only for the CSV import. Request failures, timeouts and connection loss are `Deferred` (FR-071, FR-046, FR-047).
- "Diagnostics" is `Deferred`; the Phase 13 row of §4.2 lists the same item as deferred diagnostic modes.
- The demo is one of the two deployment targets (ADR-006 point 1) and the only public one: there is no hosted backend in version 1. Its publication is `Planned (FE4)`; where it is hosted is `Deferred`.
- `12-demo-mode-spec.md` is the demo specification this phase follows. It is reconciled last in the SDD alignment order (it is frontend-only), so some of its wording, including "mock infrastructure", still needs to follow ADR-001.
- The `Deferred` items above (hosting, base path, SPA fallback, simulation bound, latency, scripted failures, reset, data layers) are decided in the frontend-stage ADR (ADR-010 point 6). They do not block B0 to B7.

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

**Status:** per item (table below); this is not a late phase: test work is spread across the blocks that build the behavior

**Owning blocks:** Backend: B0 (route tests, `Clock` port, in-memory fakes, repository contract suite, contract tests, CI), B2 (token tests), with the tests of each of B1 to B7 written inside that block; Frontend: FE5 (component, E2E and accessibility checks), with the tests of FE0 to FE4 written inside those blocks. Decisions: ADR-001 points 7 and 8, ADR-002 point 6, ADR-006 points 10 and 11, ADR-009 point 13; method in `10-testing-strategy.md`.

| Deliverable | Status | Block |
| --- | --- | --- |
| Unit and integration suites that exist today: 28 domain test files (`packages/domain`), 17 database test files (repositories and `prisma-unit-of-work.test.ts`, against PostgreSQL), 14 API test files (`app.test.ts`, middleware and route tests, against PostgreSQL); Vitest in each package | `Implemented` | none |
| Route tests for analytics, positions, assets and market, which have no route test file today, written before the services move into the application layer (ADR-001 point 8) | `Planned (B0)` | B0 |
| Health route test for `GET /health` and `GET /health/ready` (ADR-001 point 8, ADR-009 point 13); NFR-051 is `Implemented` in `apps/api/src/routes/health.ts` but no test covers either route | `Planned (B0)` | B0 |
| One shared `Clock` port injected through the composition root; domain and application code receive the time instead of calling `new Date()` (for example `validateNewTransaction`), and tests supply a fixed clock (ADR-001 point 8, `10` §49) | `Planned (B0)` | B0 |
| Application services tested with in-memory fakes of the repository contracts (ADR-001 point 7) | `Planned (B0)` | B0 |
| One repository contract suite that runs against the Prisma and the in-memory implementations, extracted from the existing Prisma repository tests (`10` §18, NFR-044) | `Planned (B0)` | B0 |
| Contract tests against the `@trading/contracts` schemas (ADR-002 point 6) | `Planned (B0)` | B0 |
| Token tests: expired token and wrong signature return 401, with refresh, logout and role enforcement tests (`10` §29); no test covers an expired or wrongly signed token today | `Planned (B2)` | B2 |
| Redaction and event-name unit tests; an integration test that a request's `requestId` appears in its log entries (ADR-009 point 13) | `Planned (B3)` | B3 |
| Tests that ship with the feature of their block: analytics (B1), jobs and idempotency (B4), realtime server and the shared simulation engine (B5), the OpenAPI document (B6) | `Planned (B1)` to `Planned (B6)`, per block | B1 to B6 |
| Minimal CI workflow on pushes and pull requests to `develop` and `main`: install with the lockfile, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm docs:check`, `pnpm test` (domain, database and API suites, the last two against a PostgreSQL service container), `pnpm build`; no coverage threshold (ADR-006 points 10 and 11) | `Planned (B0)` | B0 |
| Component tests (forms, tables, filters, loading and error states) | `Planned (FE5)`; the runner and React Testing Library `Deferred` to the frontend-stage ADR | FE5 |
| Realtime client tests (connect, disconnect, reconnect, event processing) | Server `Planned (B5)`; client `Planned (FE3)` with the feature; component and E2E checks `Planned (FE5)` | B5, FE3, FE5 |
| Demo tests: simulation determinism of the shared engine, and the demo flows with the CSV import failure | Engine `Planned (B5)`; demo flows `Planned (FE4)` | B5, FE4 |
| E2E flows (login, portfolio workflow, transaction workflow, analytics, realtime, recovery), plus the CSV import flow as a critical flow (`10` §33) | `Planned (FE5)`; Playwright `Deferred` to the frontend-stage ADR | FE5 |
| Accessibility checks | `Planned (FE5)`; the scanning tool `Deferred` to the frontend-stage ADR | FE5 |
| Demo reset, local persistence and scripted failures other than the import failure | `Deferred` to the frontend-stage ADR (ADR-010 point 6) | FE4 |
| Frontend test tooling (component runner, React Testing Library, Playwright), the accessibility scanning tool, the HTTP client timeout and retry policy, and a coverage threshold | `Deferred` (ADR-006 point 11) | none |

Code vs ADR:

- The original phase reads as one late hardening pass. ADR-001 point 8 and ADR-006 point 11 move most of it earlier: route tests, the `Clock` port and the contract suite are B0 work done before the layering refactor, and CI exists before B1. Each later block closes with its own tests, so FE5 keeps only the checks that need frontend code.
- Token-expiry and wrong-signature tests belong to B2, not to B0, and the `Clock` port from B0 is what lets them run without waiting for real time (decided by the user on 2026-10-07; `10` §29 and §49).
- The `Domain` priority area is `Implemented` (calculations, invariants and transaction rules have domain tests). The `API` priority area is partial: validation, authentication, authorization and error paths are covered in route tests, while expired tokens and role enforcement are `Planned (B2)` and malformed path parameters are `Planned (B0)` (`10` §29 to §31).
- Original layer "Component" and "E2E" have no tooling decision. ADR-006 point 11 leaves the runner, React Testing Library and Playwright to the frontend-stage ADR, and says component, E2E and accessibility checks join the CI workflow once frontend code exists. They do not block B0 to B7.
- ADR-006 point 11 sets no coverage threshold in version 1. The quality bar is the named mandatory tests (application services with in-memory fakes, contract tests against the schemas), not a percentage.
- "Demo: persistence" and "reset" are `Deferred` (ADR-010 point 6, `10` §34); only the CSV import failure and the real validation rules are decided demo failures.
- `.github/` holds only `PULL_REQUEST_TEMPLATE.md`; no workflow exists today, and the Husky pre-commit hook runs `lint-staged` only.

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

**Status:** per item (table below); the backend scope is `Planned (B3)`

**Owning blocks:** Backend: B3 (ADR-009 points 1 to 13), with `auth.logout` landing with its endpoint in B2, job entries in B4 and realtime and simulator entries in B5; Frontend: FE0 (browser-console `Logger` adapter), FE4 (demo logging). Decisions: ADR-009, ADR-006 points 11 and 12, ADR-010 point 6.

| Deliverable | Status | Block |
| --- | --- | --- |
| `Logger` port in `@trading/application` with a `pino` adapter in the API; `pino-http` for request logs; `pino-pretty` in development only; JSON on stdout, no log files, no rotation (ADR-009 points 1 to 3) | `Planned (B3)`; the port depends on `@trading/application` from B0 | B3 |
| Log fields and stable dotted event names such as `http.request.completed` (ADR-009 point 3); `LOG_LEVEL` is the only logging variable: `debug` in development, `info` in production, `silent` in tests (point 7) | `Planned (B3)` | B3 |
| Redaction of passwords, the `Authorization` header, cookies, access tokens and refresh tokens, with tests (ADR-009 point 4 and Deferred detail) | `Planned (B3)` | B3 |
| Request IDs: the `requestId` middleware generates or accepts a safe `X-Request-ID` and sets it on the response (`apps/api/src/middleware/request-id.ts`) | `Implemented` | none |
| Correlation: `requestId` propagated through `AsyncLocalStorage` to every log line of the request; `X-Request-ID` exposed through CORS (`exposedHeaders`); `jobId` and `connectionId` on job and realtime entries (ADR-009 point 5) | `Planned (B3)`; job and realtime fields with B4 and B5 | B3, B4, B5 |
| Error categorization: the error handler returns a coded error body with the `requestId` (`apps/api/src/middleware/error-handler.ts`) | `Implemented` | none |
| Error logging by category: levels by code, the event name `http.request.failed` (today `request.failed`), `errorCategory` and the stack on internal errors (ADR-009 points 3 and 6); today only unexpected errors are logged | `Planned (B3)` | B3 |
| Health checks and readiness: `GET /health` and `GET /health/ready` (`SELECT 1`), the failure line `health.database.unavailable` | `Implemented`; their route test `Planned (B0)` | B0 |
| Shutdown behavior of readiness (503 while shutting down) and the `app.startup.*` and `app.shutdown.*` entries (ADR-006 point 12, ADR-009 point 11) | `Planned (B3)` | B3 |
| Security events `auth.login.succeeded`, `auth.login.failed`, `auth.refresh.reuse_detected`, `authz.denied` and `auth.logout` (ADR-009 point 9) | `Planned (B3)`; `auth.logout` with its endpoint `Planned (B2)` | B3, B2 |
| Performance measurements: a `warn` entry when a request exceeds `SLOW_REQUEST_THRESHOLD_MS` (default 500 ms), and separate timing of the analytics series reconstruction (ADR-009 point 8); individual database operations are not timed | `Planned (B3)` | B3 |
| Realtime and background-job diagnostics: lifecycle entries for realtime connections (ADR-007) and job transitions (ADR-008); simulator entries `simulation.started`, `simulation.paused`, `simulation.mode.changed` (ADR-009 point 11) | Job entries `Planned (B4)`; realtime and simulator entries `Planned (B5)`; entry names and fields are open details | B4, B5 |
| Local debugging tools: `LOG_LEVEL=debug` with `pino-pretty` covers local debugging | `Planned (B3)` | B3 |
| Browser-console `Logger` adapter, so application code logs without knowing where it runs (ADR-009 point 1) | `Planned (FE0)`; demo event names `Deferred` (ADR-010 point 6) | FE0 |
| Metrics, a `/metrics` endpoint and process metrics | `Deferred` (ADR-009 point 10) | none |
| Realtime debug mode, diagnostics panel and demo diagnostics interface | `Deferred` to the frontend-stage ADR and the demo ADR (ADR-009 point 12, ADR-010 point 6) | none |

Code vs ADR:

- The API logs with `console` today (`apps/api/src/index.ts`, `apps/api/src/config/env.ts`) and has no logger module or logging dependency. Two lines already carry an `event` field: the unexpected-error line `request.failed` (`level`, `requestId`, `errorName`, `message`) and the readiness failure `health.database.unavailable`. Neither has a `timestamp` or `service` field, and handled errors are not logged. `X-Request-ID` is not exposed by CORS (`apps/api/src/app.ts` sets `cors({ origin })` only).
- The original task list includes "metrics". ADR-009 point 10 defers it: nothing would consume a metrics endpoint in a local deployment (NFR-070). Hosting the backend later (ADR-006 point 2) reopens this decision.
- "Realtime diagnostics", "background-job diagnostics" and "performance measurements" are read as log entries in version 1, not as dashboards or panels. Performance measurement means the slow-request entry and the series timing; broader measurement follows the measure-first rule of §3 and is planned in §32.
- "Local debugging tools" is `LOG_LEVEL` plus `pino-pretty`. `LOG_FORMAT`, `ENABLE_DEBUG_LOGGING` and `ENABLE_DEV_DIAGNOSTICS` are not adopted (ADR-009 point 2).
- The acceptance criterion "realtime disconnects" is met by connection lifecycle entries from B5, so it cannot be demonstrated before that block. "Authentication failures" depends on the security events, partly from B2.
- The checklist of `13-observability-spec.md` mixes backend, frontend and demo items; ADR-009 point 12 limits B3 to the backend and moves the rest to the frontend stage.

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

**Status:** per item (table below); there are two targets and no hosted backend (ADR-006 points 1 and 2)

**Owning blocks:** Backend: B0 (minimal CI, configuration safety), B3 (graceful shutdown), B7 (build, container, local full stack, smoke test); Frontend: FE0 (build-time variables), FE4 (demo build and publication). Decisions: ADR-006 points 1 to 13, ADR-010 point 6; spec in `14-deployment-spec.md`.

| Deliverable | Status | Block |
| --- | --- | --- |
| Targets: a local full stack for demonstrations and a public static demo of `apps/web`; no public backend (ADR-006 points 1 and 2) | `Reference` | none |
| Minimal CI workflow (see §17), with no continuous deployment (ADR-006 points 10 and 11) | `Planned (B0)` | B0 |
| Configuration safety: the seed and the hard database reset refuse to run when `NODE_ENV=production`; `CORS_ORIGIN` accepts only `http(s)://host[:port]` origins and rejects `*`; a single `.nvmrc` reused by CI and the Dockerfile (ADR-006 point 13) | `Planned (B0)` | B0 |
| Production backend build: every workspace package compiles to `dist` and exposes it through `exports`, and the API runs with `node dist/index.js` (ADR-006 point 3) | `Planned (B7)` | B7 |
| Production Docker image: `apps/api/Dockerfile`, multi-stage, non-root user, built with the workspace root as the build context, entrypoint `node dist/index.js` with no shell or package-manager wrapper so `SIGTERM` reaches the process (ADR-006 point 4) | `Planned (B7)` | B7 |
| Environment configuration for `development`, `test` and local `production`: `PORT` (default 7001), `JWT_EXPIRES_IN_SECONDS`, `APP_MODE` with `real` or `demo`, `LOG_LEVEL` and `SLOW_REQUEST_THRESHOLD_MS` (ADR-006 point 8, ADR-009) | `Implemented` in part: `apps/api/src/config/env.ts` reads `PORT` and `JWT_EXPIRES_IN_SECONDS`; it does not read `APP_MODE`, `LOG_LEVEL` or `SLOW_REQUEST_THRESHOLD_MS` and does not validate `DATABASE_URL`; the rest is `Planned (B3)` (logging variables) and `Planned (B7)` (`DATABASE_URL`, `APP_MODE`) | B3, B7 |
| Web build-time values `VITE_APP_MODE` and the API and WebSocket base URLs (proposed names `VITE_API_BASE_URL` and `VITE_WS_URL`) | `Planned (FE0)` | FE0 |
| Local full stack: a Docker Compose `full` profile with PostgreSQL and the API; the default profile keeps only PostgreSQL; `TZ=UTC` on both containers; the real-mode web app runs on the Vite dev server against the local API (ADR-006 points 4 and 8) | `Planned (B7)` | B7 |
| Migration deployment: a one-shot `migrate` service in the `full` profile runs `prisma migrate deploy` after PostgreSQL is healthy, and the API starts after it completes (ADR-006 points 4 and 5 and Deferred detail) | `Planned (B7)` | B7 |
| Health checks: `GET /health` and `GET /health/ready` exist; the container healthcheck probes `GET /health/ready` (ADR-006 point 4) | Endpoints `Implemented`; container healthcheck `Planned (B7)` | B7 |
| Graceful shutdown: on `SIGTERM` or `SIGINT` the server stops accepting connections, readiness returns 503 with `status: "unavailable"` and no `checks`, in-flight requests drain for up to 10 seconds, Prisma closes, and the exit code is 1 only if the drain times out (ADR-006 point 12) | `Planned (B3)` | B3 |
| Smoke tests: one script that runs after `docker compose --profile full up`, with no frontend step (ADR-006 point 11) | `Planned (B7)` | B7 |
| Deployment documentation: the documented steps that start and verify the local full stack | `Planned (B7)` | B7 |
| Public demo build: a static build of `apps/web` in demo mode, no backend calls, no secrets, namespaced browser storage, configurable base path, SPA fallback, and its publication (ADR-006 point 7) | `Planned (FE4)` | FE4 |
| Demo hosting, the base path value, the SPA fallback mechanism and the numeric bound of the demo simulation | `Deferred` to the frontend-stage ADR (ADR-010 point 6) | FE4 |
| Hosted backend, managed database, reverse proxy, public HTTPS and WSS, backups | `Deferred`; a hosted backend needs a new ADR (ADR-006 points 2 and 9) | none |
| Original item "HTTPS/WSS configuration" | Removed (ADR-006 point 2) | none |
| Original item "rollback documentation" | Removed: rollback is forward-fix only, because Prisma Migrate has no down migrations (ADR-006 point 6) | none |

Code vs ADR:

- The production build does not run today: `@trading/domain` and `@trading/database` set `main` to `./src/index.ts`, and the domain uses extensionless relative imports that `node dist/index.js` cannot resolve (ADR-006 Context). Fixing it is the B7 build item. `pnpm build` runs `pnpm -r build`; CI runs it from B0 to prove the packages compile, and running the built API stays in B7.
- `.github/` holds only `PULL_REQUEST_TEMPLATE.md`, `docker/` holds only `.gitkeep`, there is no `apps/api/Dockerfile`, no `.nvmrc`, and `docker-compose.yml` defines no `full` profile. The seed wipes the database with no production guard.
- The original "production frontend build" is split in two. The demo build is the only public frontend artifact (`Planned (FE4)`). The real-mode web app is not built for production in version 1 and runs on the Vite dev server (ADR-006 point 8).
- The original "deployment documentation" assumed a hosted target. It now documents only the local full stack, and states that backups are not applicable to a local environment (ADR-006 point 9).
- Graceful shutdown is B3, not B7, so `BACKEND-ROADMAP.md` (which lists it in B7) needs aligning (task T5.3). Shutdown steps for background jobs and realtime connections join the sequence in B4 and B5 (ADR-006 Deferred detail).
- The acceptance criterion "a production-like deployment can be started and verified through documented steps" is met by the local full stack plus the smoke script, not by a hosted environment.

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

**Status:** `Planned (FE5)`; nothing in this phase exists yet because `apps/web` holds only a wireframe (`apps/web/wireframe.html`)

**Owning blocks:** Backend: none; Frontend: FE5 (§4.3), after FE1 to FE4. Decisions: ADR-010 point 9 (breakpoints and interface scope), ADR-006 point 11 (accessibility tool deferred); targets in `03-non-functional-requirements.md`.

| Deliverable | Status | Block |
| --- | --- | --- |
| UX review (hierarchy, spacing, typography, visual consistency, feedback, empty states, error states, motion, responsive behavior) | `Planned (FE5)`; the breakpoints (900 px and 560 px) and the 360 px minimum viewport are decided in ADR-010 point 9 | FE5 |
| Accessibility validation (keyboard navigation, focus management, labels, semantic structure, screen reader support, reduced motion, contrast) against NFR-029 to NFR-032 | `Planned (FE5)` | FE5 |
| Accessibility scanning tool | `Deferred` to the frontend-stage ADR (ADR-006 point 11) | FE5 |
| Performance measurement against the approved targets of NFR-001 to NFR-008 (load, navigation, interaction, market update propagation, update stability, burst handling, derived analytics, large historical datasets) | `Planned (FE5)`; the measurement approach is measure first (§32) | FE5 |
| Performance fixes in the potential areas below (renders, query caching, table and chart rendering, bundle size, realtime update frequency, expensive calculations, network payloads) | `Planned (FE5)`, only where a measurement shows a miss | FE5 |
| Frontend choices that these areas depend on (rendering approach, charts, table library, state and query caching) | `Deferred` to the frontend-stage ADR | FE0 |

Code vs ADR:

- The phase keeps its scope. What changes is its owner and its input: it runs once, in FE5, against a working frontend, and it uses the targets already approved in `03`. This document sets no new metric (rule 2 of §3). No NFR sets a bundle-size or network-payload target, so those two areas are measured and reported, not judged against a number, until a decision adds one.
- The server side of performance is not part of this phase. Slow-request logging and the timing of the analytics series reconstruction are `Planned (B3)` (§18), and the server realtime limits are `Planned (B5)`.
- NFR-008 is enough for large datasets in version 1; the memory target stays `Deferred` (`10` §41).
- "Realtime update frequency" is bounded by NFR-005 and NFR-006 and needs the realtime client of FE3 to exist before it can be measured.
- The accessibility checks of this phase are the same automated and manual checks listed in `10` §36; component and E2E tests that touch them are listed in §17.

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

**Status:** `Planned (FE6)`; written last, after the frontend stage closes

**Owning blocks:** Backend: none; Frontend: FE6 (§4.3), after FE5. Source material: the ADRs, the SDDs, `PROGRESS.md`, the test and CI results, and the measured results of FE5. Rules: `00-overview.md` §15, `12-demo-mode-spec.md` §84 (no performance numbers until measured).

| Deliverable | Status | Block |
| --- | --- | --- |
| Case study written in the recommended structure below, with content derived from the ADRs and from real evidence only | `Planned (FE6)` | FE6 |
| Evidence the case study may cite: the ten ADRs (`docs/adr/`), the test suites, the CI runs from B0, the local full stack and the smoke script from B7, the public demo from FE4, and the measurements of FE5 | `Planned (FE6)`; each source exists only when its block closes | FE6 |
| Performance and outcome statements | `Planned (FE6)`, and only for what FE5 or another block measured; unmeasured figures are not published | FE6 |
| Technical interview readiness material (§43) | `Planned (FE6)` | FE6 |
| Where the case study is published and its page format | Open: no ADR decides it; `00-overview.md` §15 says it follows the existing project-page structure of the portfolio site | FE6 |

Code vs ADR:

- No case study exists. `00-overview.md` §15 marks it `Deferred` until after the frontend stage; this plan gives it a block (FE6) so that it is scheduled, and the two statements agree on timing.
- The recommended structure below and the structure in `00-overview.md` §15 (summary, context, architecture, decisions, challenges, security, performance, stack, outcomes, lessons, future evolution) differ in wording and order. Neither is a decision. Recommendation: use the structure of the portfolio site's project page when FE6 starts, and treat the list below as the content checklist.
- The backend-first order of §4.1 (ADR-006 point 1, `00-overview.md` §1) and the ADR trail are recorded decisions, so the case study can cite them as evidence without invention.
- Before FE6, claims about the demo, performance, security results or deployment are limited to what the blocks have produced. The local full stack is the only deployment evidence; there is no hosted backend (ADR-006 point 2).

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

**Status:** `Reference`; the original graph below is the intent, and the build order is the one in §4.1 and in the block graph that follows it

The original graph, kept as the logical dependency of the capabilities:

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

The order in which the blocks are built (§4.1 to §4.3):

```text
Minimal CI (B0)
    ↓
B0  Application layer and shared contracts
    ↓
B1  Portfolio performance and risk analytics
    ↓
B2  Authentication and RBAC
    ↓
B3  Observability foundation
    ↓
B4  Background jobs and idempotency
    ↓
B5  Realtime and market simulation
    ↓
B6  API documentation and contract
    ↓
B7  Deployment readiness and hardening
    ↓   the backend counts as done (§4.1)
FE0 Foundation (needs B6)
    ├─→ FE1 Core workflow (needs B2)
    │      ├─→ FE2 Analytics and tables (needs B1)
    │      └─→ FE3 Realtime and jobs (needs B4, B5)
    └─→ FE4 Demo mode (needs B0, B5)
FE1 to FE4
    ↓
FE5 Quality and refinement
    ↓
FE6 Case study
```

How the original nodes map to the blocks:

| Original node | Where it lands | Status |
| --- | --- | --- |
| Repository | Phase 0 `Implemented`; the minimal CI is the new first step | `Implemented`; CI `Planned (B0)` |
| Domain | Phase 1 `Implemented` in `packages/domain`; analytics additions in B1; application layer and contracts in B0 | `Implemented`; `Planned (B0)`, `Planned (B1)` |
| Database | Phase 2 `Implemented`; `Job` and `IdempotencyKey` in B4; runtime database role in B0 | `Implemented`; `Planned (B0)`, `Planned (B4)` |
| Backend | Phase 3 `Implemented`; layering in B0; OpenAPI document in B6 | `Implemented`; `Planned (B0)`, `Planned (B6)` |
| Auth | Phase 4 login and `me` `Implemented`; refresh, logout and roles in B2; session screens in FE1 | `Planned (B2)`, `Planned (FE1)` |
| Frontend | Phase 5, FE0 | `Planned (FE0)` |
| Core workflows, Transactions | Endpoints `Implemented`; screens in FE1 | `Planned (FE1)` |
| Analytics | Allocation and attribution `Implemented`; performance and risk in B1; views in FE2 | `Planned (B1)`, `Planned (FE2)` |
| Realtime | Server B5; client FE3 | `Planned (B5)`, `Planned (FE3)` |
| Background operations | Jobs B4; screens FE3 | `Planned (B4)`, `Planned (FE3)` |
| Demo | Engine in B5 (with the application layer from B0); demo mode in FE4 | `Planned (B5)`, `Planned (FE4)` |
| Testing | Spread across the blocks from B0; component, E2E and accessibility checks in FE5 | `Planned (B0)`, `Planned (FE5)` |
| Observability | Backend B3; browser `Logger` adapter FE0 | `Planned (B3)`, `Planned (FE0)` |
| Deployment | Local full stack B7; demo build and publication FE4 | `Planned (B7)`, `Planned (FE4)` |
| Case Study | FE6 | `Planned (FE6)` |

Code vs ADR:

- The original graph runs Backend, Auth, Frontend, then the product features, with Testing, Observability and Deployment after Demo. Development does not follow that line. All backend work, including observability (B3), the testing foundation (B0, B2) and deployment (B7), comes before the frontend stage (ADR-006 point 1, `00-overview.md` §1), so Testing, Observability and Deployment move forward and the product features split into a backend part and a frontend part.
- The block order is the order of `BACKEND-ROADMAP.md` §3, extended with B0 (ADR-001, ADR-002) and the minimal CI (ADR-006 point 11): B3 before B4 and B5 because asynchronous work is hardest to debug blind, and B4 before B5 because job progress is a realtime event (ADR-007 point 15). The roadmap does not list B0 yet (task T5.3).
- The frontend edges are the "Depends on" column of §4.3. FE0 also needs the frontend-stage ADR (§4.3), which is not a block and is not drawn. The stage starts only when the backend counts as done (§4.1), which is stricter than the single B6 edge shown for FE0.
- "Once contracts are stable, some implementation work may proceed concurrently" does not apply between the backend and the frontend stages in version 1 (§4 and §4.1). Whether FE2, FE3 and FE4, which depend on different blocks, overlap is not decided; the numeric order of §4.3 is the default.

---

## 23. Recommended Vertical Slices

**Status:** per item (table below); slices run inside each block, not across the two stages (§4.1)

**Owning blocks:** each slice has a backend part and, except the demo, a frontend part; the table maps both. Slice size inside a block follows the block method: read the code and the specs, propose small slices, apply, verify, commit.

| Slice | Backend part | Frontend part (`Planned (FE)`) |
| --- | --- | --- |
| 1 Authentication | Login and `me` `Implemented`; refresh, logout and role enforcement `Planned (B2)` | Session screens and the authenticated shell: FE1, on the FE0 foundation |
| 2 Portfolio | API and database `Implemented`; layering and archived-portfolio guard `Planned (B0)` | Portfolio screens: FE1 |
| 3 Transaction | Validation, persistence and position update `Implemented`; `Clock` port and chronological validation `Planned (B0)`; fee handling `Planned (B1)`; `Idempotency-Key` `Planned (B4)` | Transaction and position screens: FE1 |
| 4 Analytics | Allocation and attribution `Implemented`; performance and risk calculation and endpoints `Planned (B1)` | Table and chart views: FE2 |
| 5 Realtime | Server and event contract `Planned (B5)` | Client, notifications and alerts: FE3 |
| 6 Background operation | CSV import job, progress and completion `Planned (B4)`; job events over the socket `Planned (B5)` | Upload, progress and completion screens: FE3 |
| 7 Demo | Application layer and in-memory repositories `Planned (B0)`; shared simulation engine `Planned (B5)` | In-process adapters, composition root and publication: FE4 |

Code vs ADR:

- The original slices cut through the whole stack at once (API, database and UI). With the backend-first order (§4.1), each slice is delivered in two passes: the backend part in its block, then the frontend part in its block after the backend counts as done. A slice is complete only when both passes are.
- Slice 1 "Authenticated shell": the shell belongs to FE0 and FE1, and the session behavior it relies on (refresh, logout, roles) is B2, so slice 1 cannot be shown end to end before FE1.
- Slice 7 says "Mock infrastructure". ADR-001 replaces mocks with in-memory implementations of the real repository contracts and the real application layer, run in the browser (see the Phase 11 note in §16). There is no mock HTTP layer.
- The frontend parts of all slices are `Planned (FE)`. Slice 5 needs both B5 and FE3, and slice 6 needs B4, B5 and FE3 (§4.3), so they are the last backend-dependent slices to close.
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
