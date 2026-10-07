# SDD 14 — Deployment Specification

**Project:** Trading Analytics Platform  
**Document:** Deployment Specification  
**Version:** 1.0  
**Status:** Sections 1-20 reconciled with the code and the ADRs on 2026-10-07 (model and targets from ADR-006; graceful shutdown from ADR-006 point 12); each carries a status and the details it leaves open. Sections 21-96 are reconciled in later slices.  
**Previous document:** `13-observability-spec.md`  
**Next document:** `15-implementation-plan.md`

---

## 1. Purpose

**Status:** `Reference`

This document defines how the Trading Analytics Platform is packaged, configured, started, validated, and deployed across local development, CI/test, public demo, and production-like environments.

The deployment strategy must preserve the architecture defined by the previous SDDs while remaining practical for a portfolio project and technical interview.

It must support:

- reproducible local setup
- Docker-based infrastructure
- isolated frontend/backend services
- PostgreSQL
- REST and WebSocket communication
- environment-based configuration
- database migrations and seeds
- health checks
- observability
- CI validation
- production builds
- free/no-recurring-cost development and demo paths
- separation between demo and real infrastructure

Code vs ADR:

- ADR-006 fixes the deployment model: exactly two targets, the local full stack and the public demo (§3). The backend is never hosted, so "production-like" means the local full stack and the "frontend/backend services" are not deployed separately.
- Where each capability stands: PostgreSQL in Docker, environment configuration, migrations, seeds and health checks `Implemented`; observability `Planned (B3)`; CI `Planned (B0)`; production build and the full-stack containers `Planned (B7)`; WebSocket `Planned (B5)`; the public demo `Planned (FE)`.

---

# 2. Deployment Principles

**Status:** `Reference`

1. **Reproducible**
2. **Environment-aware**
3. **Configuration-driven**
4. **Container-friendly**
5. **Stateless application services where practical**
6. **Explicit database migrations**
7. **Observable**
8. **Deterministic builds**
9. **Secrets outside source control**
10. **Demo mode independent of paid infrastructure**
11. **Local architecture reasonably close to production**
12. **Complexity proportional to project needs**

Deployment is an infrastructure concern and should not leak into domain logic.

Code vs ADR:

- Principle 6 holds with one change: Prisma Migrate has no down migrations, so rollback is forward-fix only (ADR-006 point 6; §18).
- Principle 7 depends on B3 (ADR-009), and principle 8 on the production build (B7, ADR-006 point 3) and on CI from a clean checkout (B0, ADR-006 point 10).
- Principle 10 is ADR-006 point 7: the demo has no backend, no secrets and no running cost.
- Principle 11 is bounded by ADR-006 point 2: there is no hosted production, so "close to production" means the `full` Compose profile (§6).

---

# 3. Deployment Targets

**Status:** per item (table below)

| Environment | Purpose | Status |
|---|---|---|
| Local Development | Daily development | `Implemented`: PostgreSQL through Compose, API through `pnpm --filter @trading/api dev` (`apps/api/package.json`) |
| Test / CI | Automated validation | Local test runs `Implemented` (`vitest`, `.env.test.local`); the GitHub Actions workflow `Planned (B0)` (ADR-006 point 10) |
| Demo | Public portfolio experience | `Planned (FE)`: static build of `apps/web` in demo mode under a subpath (ADR-006 points 1 and 7) |
| Production-like | Deployment validation | `Planned (B7)`: the local full stack, `full` Compose profile with PostgreSQL and the API (ADR-006 points 1 and 4) |

The same application artifacts should be reused whenever possible, with environment-specific configuration determining infrastructure.

```text
                    Source Code
                         │
                         ▼
                    Build / Test
                         │
             ┌───────────┼───────────┐
             │           │           │
           Local         CI       Deployable
             │                       │
             │              ┌────────┴────────┐
             │              │                 │
          Docker         Demo mode      Production-like
```

Code vs ADR:

- ADR-006 point 1 decides two targets only. "Local Development" and "Test / CI" are environments (ADR-006 point 8: `development`, `test` and local `production`), not deployment targets.
- The two targets do not share one artifact. The demo is a static web build; the full stack is the API built with `node dist/index.js` plus PostgreSQL. What they share is the workspace packages (ADR-001, ADR-002).
- Hosting, a managed database, a reverse proxy and public WSS are `Deferred`: hosting the backend needs a new ADR (ADR-006 point 2).
- `pnpm build` runs `pnpm -r build` and every package has a `build` script, but the output does not run (ADR-006 context; `@trading/domain` and `@trading/database` set `main` to `./src/index.ts`). The production build is B7.

---

# 4. Local Development Architecture

**Status:** PostgreSQL and API `Implemented`; frontend `Planned (FE)`

Recommended topology:

```text
┌───────────────────────────────────────────────┐
│                 Local Machine                │
│                                               │
│  ┌──────────────┐                             │
│  │   Frontend   │                             │
│  │ React + Vite │                             │
│  └──────┬───────┘                             │
│         │ HTTP / WebSocket                    │
│         ▼                                     │
│  ┌──────────────┐                             │
│  │    API       │                             │
│  │ Node/Express │                             │
│  └──────┬───────┘                             │
│         │                                     │
│         ▼                                     │
│  ┌──────────────┐                             │
│  │  PostgreSQL  │                             │
│  └──────────────┘                             │
└───────────────────────────────────────────────┘
```

Docker should provide PostgreSQL and may provide the complete stack.

Code vs ADR:

- `apps/web` holds only `WIREFRAME-PLAN.md` and `wireframe.html`; there is no React or Vite code. The frontend box is `Planned (FE)`, and the WebSocket path of the arrow is `Planned (B5)`.
- Today the API runs on the host and reaches PostgreSQL through the published port on `localhost`.
- ADR-006 point 4 settles "may provide the complete stack": the default Compose profile holds only PostgreSQL, and a `full` profile adds the API (`Planned (B7)`). No frontend container is decided (§5).

---

# 5. Docker Strategy

**Status:** per item (table below)

Docker is part of the reproducible development and deployment strategy.

At minimum:

```text
postgres
```

should be containerized.

A complete Compose environment may contain:

```text
frontend
backend
postgres
```

Additional infrastructure must only be introduced when justified.

| Item | Status |
|---|---|
| `postgres` container | `Implemented` (`docker-compose.yml`, image `postgres:18`) |
| `backend` container: multi-stage API Dockerfile, non-root user | `Planned (B7)` (ADR-006 point 4); no Dockerfile exists, and `docker/` holds only `.gitkeep` |
| `frontend` container | `Deferred`: ADR-006 does not decide one; the frontend ships as a static demo build |

Code vs ADR:

- The three-service Compose of the original text is replaced by ADR-006 point 4: PostgreSQL in the default profile, PostgreSQL and the API in `full`.
- Open (B7): whether a frontend container ever exists. Recommendation: not in v1, because the public demo is static and a local full-stack run can use the Vite dev server.

---

# 6. Docker Compose

**Status:** per item (table below)

Docker Compose should be the primary local orchestration mechanism.

It should support:

- startup/shutdown
- service networking
- health dependencies
- environment variables
- persistent PostgreSQL volume
- isolated database state
- development workflow

| Capability | Status |
|---|---|
| Startup/shutdown | `Implemented`: `docker compose up -d` and `docker compose down` |
| Service networking | `Planned (B7)`: one service exists today, so there is nothing to network |
| Health dependencies | PostgreSQL healthcheck `Implemented` (`pg_isready`, 5 s interval, 5 retries); API `depends_on` with `condition: service_healthy` `Planned (B7)` (ADR-006, Deferred detail) |
| Environment variables | `Implemented`: `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` and `DATABASE_PORT`, each with a default |
| Persistent PostgreSQL volume | `Implemented`: named volume `trading-analytics-postgres-data`, mounted at `/var/lib/postgresql` |
| Isolated database state | Per environment, `Implemented` by convention: `trading_analytics_dev` for development, and a separate `trading_analytics_test` on the same instance created by hand (`.env.test.example`) |
| Development workflow | `Implemented`: the default profile is PostgreSQL only |
| `full` profile | `Planned (B7)` (ADR-006 point 4) |

Conceptual structure:

```yaml
services:
  postgres: # default profile, Implemented
  api: # profile "full", Planned (B7)
```

Exact configuration belongs to implementation.

Code vs ADR:

- The conceptual structure drops `frontend` and renames `backend` to `api`, following ADR-006 point 4.
- `docker-compose.yml` has no `profiles` key yet. It fixes `container_name: trading-analytics-postgres` and `restart: unless-stopped`.
- The Compose fallback password (`trading_dev_password`) differs from the `.env.example` placeholder (`change_me_in_local_env`). With no `.env`, Compose still starts, with the fallback. Both are local-only values.
- `DATABASE_URL` repeats the user, password, port and database of the four Compose variables and is edited by hand; nothing keeps them in step.
- The container's user is a PostgreSQL superuser, and the API connects as that user at runtime. A separate runtime role is `Planned (B0)` (ADR-005 point 13).
- The port is published on every host interface (`${DATABASE_PORT:-5432}:5432`). Whether it binds to `127.0.0.1` is an open detail (B7), tracked in `09-security-spec.md` §36.

---

# 7. Service Responsibilities

**Status:** per item (table below)

### Frontend

- React application
- user interface
- API communication
- WebSocket connection
- production static build

All frontend responsibilities are `Planned (FE)`. The production static build is the demo build of ADR-006 point 7.

### Backend

- REST API
- authentication
- authorization
- application/domain orchestration
- PostgreSQL access
- WebSocket server
- background operations
- health checks
- observability

| Responsibility | Status |
|---|---|
| REST API | `Implemented` (`apps/api`, Express 5) |
| Authentication | `Implemented` as a login and a single access token; refresh and logout `Planned (B2)` (ADR-005) |
| Authorization | `Planned (B2)`: roles `VIEWER`, `TRADER`, `ADMIN` (ADR-005); the code has `USER` and `ADMIN` (`schema.prisma`, `09-security-spec.md`) |
| Application/domain orchestration | Domain `Implemented` (`@trading/domain`); services call repositories directly today, and the application layer is `Planned (B0)` (ADR-001) |
| PostgreSQL access | `Implemented` (`@trading/database`, Prisma 6) |
| WebSocket server | `Planned (B5)` (ADR-007) |
| Background operations | `Planned (B4)`: in-process job runner (ADR-008) |
| Health checks | `Implemented` (`GET /health`, `GET /health/ready`) |
| Observability | `Planned (B3)` (ADR-009) |

### PostgreSQL

- persistent relational data
- transactions
- constraints
- indexes
- migrations

All PostgreSQL responsibilities are `Implemented` (`packages/database/prisma/schema.prisma` and `migrations/`).

---

# 8. Container Networking

**Status:** `Planned (B7)`: only PostgreSQL is a container today

Containers should communicate through an internal network.

```text
frontend ──HTTP────► backend
frontend ──WS──────► backend
backend  ──────────► postgres
```

Docker-internal hostnames must never be exposed as browser configuration.

Code vs ADR:

- There is no container network yet. In the `full` profile only `api` to `postgres` applies; the `frontend` arrows belong to the browser, which reaches the published API port on the host (`Planned (FE)` for the client).
- The rule on internal hostnames stays `Reference`. It matters in B7: an API run in a container reaches PostgreSQL by service name, and one run on the host by `localhost`, so `DATABASE_URL` differs between the two. How B7 supplies it is open.

---

# 9. Port Strategy

**Status:** per item (table below)

Local ports must be predictable and documented.

Suggested defaults:

```text
Frontend: 5173
Backend:  7001
Database: 5432
```

These are defaults, not architectural requirements.

| Service | Default | Status |
|---|---|---|
| Frontend | 5173 | `Planned (FE)`: the Vite default; the API's `CORS_ORIGIN` default is `http://localhost:5173` (`env.ts`) |
| Backend | 7001 | `Implemented`: `PORT`, default `7001` (`env.ts`, `.env.example`; ADR-006 point 8) |
| Database | 5432 | `Implemented`: `DATABASE_PORT`, default `5432`, published on every host interface (`docker-compose.yml`) |

Code vs ADR:

- The original text listed the backend on 3000. ADR-006 point 8 fixes the canonical default at 7001, as the code has it; 3000 is removed.
- The backend port is therefore a decided default, not only a suggestion. The frontend port stays a suggestion.

---

# 10. Environment Configuration

**Status:** per item (table below)

Configuration must be externalized.

Variables, with the names of `apps/api/src/config/env.ts` and ADR-006 point 8:

| Variable | Meaning | Status |
|---|---|---|
| `NODE_ENV` | `development`, `test` or `production`; default `development` | `Implemented` |
| `PORT` | API port; default `7001` | `Implemented` |
| `DATABASE_URL` | PostgreSQL connection string, read by Prisma (`schema.prisma`) | `Implemented` as a Prisma input; not validated by `env.ts` (§12) |
| `CORS_ORIGIN` | Comma-separated allowed browser origins; default `http://localhost:5173` | `Implemented` |
| `JWT_SECRET` | Token signing secret; at least 32 characters, no default | `Implemented` |
| `JWT_EXPIRES_IN_SECONDS` | Access token lifetime in seconds; default `900` | `Implemented`; replaces `JWT_EXPIRES_IN` (ADR-006 point 8) |
| `LOG_LEVEL` | `debug` in development, `info` in production, `silent` in tests | `Planned (B3)` (ADR-009 point 7) |
| `SLOW_REQUEST_THRESHOLD_MS` | Slow-request `warn` threshold for HTTP requests; default `500` | `Planned (B3)` (ADR-009 point 8) |
| `APP_MODE` | `real` or `demo`; exposed to the web build as `VITE_APP_MODE` | `Planned (FE)` (ADR-006 point 8); replaces `DEMO_MODE` |
| `WEBSOCKET_PATH` | WebSocket endpoint path | `Deferred`: no ADR decides a variable for it (open detail, B5) |
| `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_PORT` | Read by `docker-compose.yml` only | `Implemented` |

`LOG_FORMAT`, `ENABLE_DEBUG_LOGGING` and `ENABLE_DEV_DIAGNOSTICS` are not adopted (ADR-009 point 2).

Configuration, secrets, code and runtime state must remain separate concerns.

Code vs ADR:

- The original list used `JWT_EXPIRES_IN` and `DEMO_MODE`. Both are replaced by the canonical names of ADR-006 point 8.
- `env.ts` validates `NODE_ENV`, `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS` and `CORS_ORIGIN` only. It does not read `APP_MODE`, so the API has no mode switch today; ADR-006 point 8 names `APP_MODE` as the canonical variable for the web build.
- This table is the current variable list. Each new variable joins it in the block that adds it.

---

# 11. Environment Files

**Status:** `Implemented`; per-environment documentation in the repository `Planned (B0)`

Local development may use:

```text
.env
.env.example
```

Tests use a third file, `.env.test.local`, copied from `.env.test.example` (`apps/api` and `packages/database` run `dotenv -e ../../.env.test.local`). `.env` and `.env.*.local` are git-ignored (`.gitignore`).

`.env.example` must contain placeholders only.

Real secrets must never be committed.

The repository must document which variables are required for:

- local development
- tests
- demo
- production-like deployment

| Environment | Required variables | Status |
|---|---|---|
| Local development (`.env`) | `DATABASE_URL`, `JWT_SECRET`; the rest have defaults. The Compose variables are optional | `Implemented` |
| Tests (`.env.test.local`) | `DATABASE_URL` pointing at the separate test database, `NODE_ENV=test`, `JWT_SECRET` | `Implemented` |
| Demo | No server variables. Build-time `VITE_APP_MODE=demo` and a base path; no secrets (ADR-006 point 7) | `Planned (FE)` |
| Production-like (local `production`) | `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, plus `PORT` and `CORS_ORIGIN` if they differ from the defaults | `Planned (B7)` |

Code vs ADR:

- No repository document lists these variables outside this table; `README.md` and `CONTRIBUTING.md` are aligned in T5.2.
- `.env.example` opens with a stale Spanish note ("variables reales se agregan a medida que se implementen") although the API variables already exist, and it lacks `LOG_LEVEL` and `SLOW_REQUEST_THRESHOLD_MS` (B3) and `APP_MODE` (FE). Fixing the file is a code change and belongs to the block that adds each variable.
- `.env.test.example` sets `NODE_ENV=test`, which disables rate limiting in the integration suite (`apps/api/src/middleware/rate-limit.ts`). `LOG_LEVEL=silent` in tests is `Planned (B3)` (ADR-009 point 7).

---

# 12. Configuration Validation

**Status:** `Implemented` for the five variables `env.ts` validates; `DATABASE_URL` `Planned (B7)` (`09-security-spec.md` §43); `LOG_LEVEL`, `SLOW_REQUEST_THRESHOLD_MS` and `APP_MODE` join with their blocks

Backend configuration must be validated at startup.

```text
Process starts
      │
      ▼
Load environment
      │
      ▼
Validate configuration
      │
      ├── invalid → fail fast
      │
      └── valid
            │
            ▼
      initialize services
```

Invalid configuration should prevent the service from accepting traffic.

Code vs ADR:

- `apps/api/src/config/env.ts` parses `process.env` with a `zod` schema when the module is first imported, and on failure prints the key and its message and calls `process.exit(1)`. `index.ts` imports it before `app.listen`, so an invalid value stops the process before it accepts traffic.
- The message never carries the value, only the key and the rule (for example "JWT_SECRET must be at least 32 characters long."). The output goes through `console.error`, not the `Logger` of ADR-009 (B3).
- Not validated today: `DATABASE_URL`. A missing or malformed value surfaces at the first query, so the API starts and `GET /health/ready` answers 503. Adding it to the schema is `Planned (B7)` (`09-security-spec.md` §43).
- `NODE_ENV=production` imposes no extra rule in the schema (for example a stricter `JWT_SECRET`). No ADR decides one.

---

# 13. Secrets Management

**Status:** `Reference`

Secrets include:

- JWT signing secrets
- database passwords
- private keys
- deployment credentials
- future provider credentials

Secrets must be injected at runtime through environment/deployment secret mechanisms.

Never:

- commit secrets
- place server secrets in frontend variables
- print secrets in logs
- expose credentials through health endpoints
- include real credentials in examples

Code vs ADR:

- Locally, the runtime mechanism is the git-ignored `.env`, loaded by `dotenv-cli` in the `dev` and `start` scripts of `apps/api` and in the `packages/database` scripts.
- ADR-006 point 2 hosts nothing, so "deployment credentials" and "future provider credentials" do not exist in v1. CI needs only throwaway test values supplied to the workflow (ADR-006 consequences; `Planned (B0)`).
- The readiness endpoint returns a generic `unavailable` and no driver detail (`apps/api/src/controllers/health.controller.ts`). `env.ts` prints keys, not values. The examples contain placeholders and test-only values (`.env.example`, `.env.test.example`). The security view of these rules is `09-security-spec.md` §43.

---

# 14. Frontend Configuration

**Status:** `Planned (FE)`; the base URLs `Deferred`

Only public configuration may be exposed to the frontend.

Examples:

- API base URL
- WebSocket URL
- public environment identifier
- demo configuration

Never expose:

```text
JWT_SECRET
DATABASE_URL
private API keys
server credentials
```

Vite variables must be treated as public unless explicitly guaranteed otherwise.

| Item | Status |
|---|---|
| Public environment identifier | `Planned (FE)`: `VITE_APP_MODE`, from `APP_MODE` (ADR-006 point 8) |
| Demo configuration | `Planned (FE)`: configurable base path, SPA fallback and namespaced browser storage (ADR-006 point 7); the demo calls no backend |
| API base URL and WebSocket URL | `Deferred`: no ADR decides how the real-mode web build receives them (open detail, FE) |

Code vs ADR:

- There is no web code, so nothing is exposed today. In the demo build no backend URL is needed (ADR-006 point 7).
- Only `VITE_`-prefixed variables reach the web build, and none may be a secret (ADR-006 point 7; `09-security-spec.md` §43).

---

# 15. Backend Startup Sequence

**Status:** per step (table below)

Recommended lifecycle:

```text
Process starts
     ↓
Load configuration
     ↓
Validate configuration
     ↓
Initialize observability
     ↓
Initialize database
     ↓
Validate dependencies
     ↓
Initialize application services
     ↓
Initialize HTTP server
     ↓
Initialize WebSocket layer
     ↓
Expose readiness
```

Exact ordering may be adjusted during implementation.

What `apps/api/src/index.ts` does today:

| Step | Today | Status |
|---|---|---|
| Load and validate configuration | Importing `config/env.ts` parses the environment and exits on failure (§12) | `Implemented` |
| Initialize observability | Not present; two `console` lines and a startup `console.log` | `Planned (B3)` (ADR-009 point 11 adds the startup entry) |
| Initialize database | The Prisma client is a shared singleton created when `@trading/database` is imported (`packages/database/src/client.ts`); no explicit connect, so no connection is attempted at startup | `Implemented` as implicit; explicit check `Planned (B7)` (`DATABASE_URL` validation, §12) |
| Validate dependencies | Not present; readiness runs a `SELECT 1` on each `GET /health/ready` call | `Implemented` as a per-request check only |
| Apply migrations | Manual (`db:migrate`, `db:test:migrate`); `prisma migrate deploy` at startup of the full stack | `Planned (B7)` (ADR-006 point 5) |
| Initialize application services | `createApp()` wires middleware, routes and services | `Implemented` |
| Initialize HTTP server | `app.listen(env.PORT)`, then `[api] listening on port <n>` | `Implemented` |
| Resume background jobs | `PROCESSING` jobs fail as `INTERRUPTED`, and `QUEUED` jobs resume | `Planned (B4)` (ADR-008 point 5) |
| Initialize WebSocket layer | Not present | `Planned (B5)` (ADR-007) |
| Expose readiness | `GET /health/ready` answers as soon as the server listens | `Implemented` |

Code vs ADR:

- The sequence is a target, and the table lists where the code departs from it. The API is ready to serve as soon as `listen` returns, with no gate on the database.
- Open (B7): where `migrate deploy` runs (the API process or the container entrypoint) and its position relative to the PostgreSQL healthcheck (ADR-006, Deferred detail). Recommendation: the container entrypoint, so the API process stays free of schema changes.
- Open (B3): the log level of the startup entry (ADR-009, Deferred detail).

---

# 16. Graceful Shutdown

**Status:** HTTP and database steps `Planned (B3)` (ADR-006 point 12); job and realtime steps `Planned (B4)` and `Planned (B5)`; no signal handling exists today

The backend must support graceful shutdown.

```text
Shutdown signal
      ↓
Stop accepting new work
      ↓
Stop new background jobs
      ↓
Handle realtime connections
      ↓
Finish/cancel active operations safely
      ↓
Close database pool
      ↓
Flush critical diagnostics
      ↓
Exit
```

The implementation should handle appropriate Node.js termination signals.

Decided (ADR-006 point 12): on `SIGTERM` or `SIGINT`, the API:

- stops accepting connections;
- returns 503 from `GET /health/ready` while it is shutting down;
- drains in-flight requests, with a timeout of 10 seconds;
- closes Prisma;
- logs `app.shutdown.started` and `app.shutdown.completed` (ADR-009 point 11).

| Step of the diagram | Status |
|---|---|
| Shutdown signal: `SIGTERM` and `SIGINT` | `Planned (B3)` |
| Stop accepting new work: server stops accepting connections; readiness 503 | `Planned (B3)` |
| Stop new background jobs | `Planned (B4)`: joins the sequence when the job runner exists (ADR-006, Deferred detail) |
| Handle realtime connections | `Planned (B5)`: joins the sequence when the realtime server exists (ADR-006, Deferred detail); the close code and message are not decided |
| Finish or cancel active operations: drain in-flight requests, 10 s timeout | `Planned (B3)` |
| Close database pool: Prisma closed | `Planned (B3)` |
| Flush critical diagnostics | No separate step is decided: ADR-009 point 3 writes one JSON line per event to stdout, with no log files and no buffered transport in production |
| Exit | `Planned (B3)` |

Code vs ADR:

- `apps/api/src/index.ts` discards the value `app.listen` returns and registers no signal handler, so a signal ends the process at once and drops in-flight requests. Prisma is never disconnected. The original text said "appropriate signals"; ADR-006 point 12 names `SIGTERM` and `SIGINT`.
- Open (B3): what happens when the 10-second drain expires, and the exit code. Recommendation: close the remaining connections, log it in `app.shutdown.completed`, and exit with code 1 on a timeout and 0 otherwise.
- Open (B3): the log levels of the two shutdown entries (ADR-009, Deferred detail).
- Open (B4, B5): what stopping jobs means for a `PROCESSING` import (ADR-008 point 5 marks an interrupted job `FAILED` on the next startup) and how realtime connections are closed.

---

# 17. Database Deployment

**Status:** per item (table below)

PostgreSQL is the primary persistent database.

Deployment must define:

- database creation
- migrations
- seeds
- connection configuration
- pool configuration
- reset process
- production backup expectations

| Item | Status |
|---|---|
| Database creation | Development database `Implemented` through `POSTGRES_DB` in Compose; the test database is created by hand (`CREATE DATABASE trading_analytics_test`, `.env.test.example`); a CI service container `Planned (B0)` (ADR-006 point 10) |
| Migrations | `Implemented` (§18); applied at startup in the full stack `Planned (B7)` (ADR-006 point 5) |
| Seeds | `Implemented` (§20); never automatic (ADR-006 point 5) |
| Connection configuration | `Implemented`: `DATABASE_URL`, with `?schema=public`; startup validation `Planned (B7)` (§12); a runtime role separate from the migration role `Planned (B0)` (ADR-005 point 13) |
| Pool configuration | `Deferred`: no ADR decides it; Prisma's defaults apply (open detail listed in `13-observability-spec.md`) |
| Reset process | `Implemented` (§21) |
| Production backup expectations | `Reference`: not applicable to a local environment; documented as such, not claimed (ADR-006 point 9) |

Code vs ADR:

- The API connects with the container's superuser (`POSTGRES_USER`) today. The migration role keeping DDL rights and a data-only runtime role are decided in ADR-005 point 13 (`Planned (B0)`).
- There is no backup because there is no hosted database (ADR-006 points 2 and 9). The local database can be rebuilt from migrations and the seed.

---

# 18. Database Migrations

**Status:** `Implemented` with Prisma Migrate; CI and startup application `Planned (B0)` and `Planned (B7)`

Schema changes must be versioned.

The project must use a migration system that supports:

- applying migrations
- checking migration state
- controlled rollback where safe

Manual production schema edits are not an acceptable normal workflow.

```text
Model change
    ↓
Migration
    ↓
Local validation
    ↓
Tests
    ↓
CI
    ↓
Deployment
```

| Capability | Status |
|---|---|
| Applying migrations | `Implemented`: `pnpm --filter @trading/database db:migrate` (`prisma migrate dev`, development) and `db:test:migrate` (`prisma migrate deploy`, test database); 10 migrations in `packages/database/prisma/migrations/` |
| Checking migration state | Available through the Prisma CLI (`prisma migrate status`); no package script wraps it |
| Controlled rollback | Removed: forward-fix only (ADR-006 point 6) |
| `CI` step of the diagram | `Planned (B0)` (ADR-006 point 10) |
| `Deployment` step of the diagram | `Planned (B7)`: `prisma migrate deploy` at startup of the full stack (ADR-006 point 5); there is no hosted deployment |

Code vs ADR:

- The original text required "controlled rollback where safe". Prisma Migrate has no down migrations, so ADR-006 point 6 removes it: a mistake is corrected by a new forward migration.
- "Manual production schema edits" has no production target (ADR-006 point 2); the rule still applies to the local full stack, where schema changes go through migrations.
- `db:migrate` uses `prisma migrate dev`, which can create a migration and reset the development database on drift. It is a development command and must not run in the full stack.

---

# 19. Migration Safety

**Status:** `Reference`

Migrations must be:

- deterministic
- reviewed
- tested
- explicit about destructive changes
- compatible with application deployment sequencing where possible

Destructive migrations must not be introduced casually.

A forward-compatible migration can be safer than an immediate rollback when data has already changed.

Code vs ADR:

- "Reviewed" is the pull request review; "tested" is the migration applied to the test database (`db:test:migrate`) before the suites run, and in CI `Planned (B0)`. No automated check flags a destructive statement, and no ADR decides one.
- Forward-only is ADR-006 point 6, so the last sentence is the rule, not an option.
- Sequencing: the full stack applies migrations at the start of the same run that starts the API (ADR-006 point 5), and PostgreSQL health is awaited first (`Planned (B7)`, ADR-006 Deferred detail).

---

# 20. Seed Data

**Status:** `Implemented` for the development seed; the Demo Mode data layers `Deferred`

Development/test environments should support controlled seed data.

It may include:

- users
- roles
- portfolios
- positions
- transactions
- instruments
- analytics history

Seed data must be coherent enough to exercise primary product flows.

It must remain separate from the browser-only/mock Demo Mode infrastructure.

| Item | Status |
|---|---|
| Seed workflow | `Implemented`: `pnpm --filter @trading/database db:seed` (`packages/database/prisma/seed.ts`, `src/seed/`); `db:reset` also reseeds through the `prisma.seed` setting |
| Content | `Implemented`: one demo user and its login credential, 3 portfolios, 7 assets, positions, transactions, decisions, scenarios, alerts, notifications and 30 days of historical prices per asset (`README.md`) |
| Never automatic | `Implemented`: no startup or migration step runs it (ADR-006 point 5) |
| Roles | One user with the default role `USER`; `VIEWER`, `TRADER` and `ADMIN` `Planned (B2)` (ADR-005) |
| Demo Mode data layers | `Deferred` with the demo specifics (`05-data-model.md` §34-37; ADR-010 point 6) |

Code vs ADR:

- The seed always runs `wipeDatabase()` first, so it deletes existing rows before it inserts (`packages/database/src/seed/index.ts`, `wipe.ts`). That is acceptable for a local development database. No guard checks `NODE_ENV` or the database name, so running it against another `DATABASE_URL` deletes that data. Open (B0): add a guard. Recommendation: refuse to run when `NODE_ENV=production`.
- The seed is Prisma and PostgreSQL data for the real API. It is not the demo's in-browser mock data (ADR-001, ADR-002, ADR-010 point 6), which stays a separate layer.

---

# 21. Database Reset

**Status:** per item (table below)

Local development should provide a documented reset workflow:

```text
Reset
 ↓
Recreate schema
 ↓
Run migrations
 ↓
Seed
```

This must be clearly separated from production operations.

| Workflow | Command | Status |
|---|---|---|
| Light reset (data only) | `pnpm --filter @trading/database db:seed`: deletes the seeded tables and reinserts the baseline; the schema is untouched (§20) | `Implemented` |
| Hard reset (schema and data) | `pnpm --filter @trading/database db:reset` runs `prisma migrate reset`: drops and recreates the database, reapplies every migration, then runs the seed through the `prisma.seed` setting. Prisma asks for confirmation first (`README.md`, "Local Database") | `Implemented` |
| Test database | No reset script. `db:test:migrate` only applies migrations (`prisma migrate deploy` with `.env.test.local`) | `Implemented` as migrate only |
| Guard against a non-local database | None | `Planned (B0)`, open |
| Demo reset | Resetting the demo's browser-side state | `Deferred` (ADR-010 point 6; `05-data-model.md` §34-37) |

Code vs ADR:

- The diagram describes the hard reset. The light reset skips "Recreate schema" and "Run migrations".
- Both commands act on the database named by `DATABASE_URL` in `.env` (`packages/database/package.json`). Nothing checks `NODE_ENV` or the database name. The only guard is Prisma's confirmation on the hard reset; the seed has none (§20, open B0).
- "Clearly separated from production operations" holds by construction: there is no production database (ADR-006 point 2), and the reset commands read `.env` while the tests read `.env.test.local`, so a reset never touches the test database unless both files point at the same one. A backup to restore from does not exist either (ADR-006 point 9).
- The full stack never seeds on startup (ADR-006 point 5), so a demonstration that needs data runs the seed as an explicit command (`Planned (B7)` for the stack itself).

---

# 22. Demo Deployment

**Status:** `Planned (FE)`; simulated latency and failures `Deferred`

The public demo must not require the complete real infrastructure when unnecessary.

It follows the infrastructure substitution strategy defined in `12-demo-mode-spec.md`.

```text
Public Demo
    ↓
React application
    ↓
Mock adapters
    ├── mock API
    ├── local persistence
    ├── simulated latency/failures
    └── simulated realtime
```

The demo remains a functional product experience, not a static mockup.

| Item | Status |
|---|---|
| Static build of `apps/web` in demo mode, hosted under a subpath of the author's portfolio site | `Planned (FE)` (ADR-006 points 1 and 7) |
| No backend, no secrets, no running cost | `Planned (FE)` (ADR-006 point 7; `04-tech-stack.md` §49) |
| Demo composition root with in-memory implementations of the repository contracts, calling `@trading/application` and the presenters of `@trading/contracts` | `Planned (FE)` (ADR-001 point 4; ADR-002 point 5) |
| Local persistence: namespaced browser storage | `Planned (FE)` (ADR-006 point 7); what is stored and how it resets is `Deferred` (ADR-010 point 6) |
| Simulated latency and scripted failures | `Deferred` (ADR-010 point 6) |
| Simulated realtime: in-process adapter fed by `@trading/market-sim` | Engine `Planned (B5)` (ADR-007 point 7); adapter `Planned (FE)` |

Code vs ADR:

- The "mock API" box is the in-process adapter behind the `TradingClient` port, not an HTTP mock. Mocking at the HTTP client level was rejected (ADR-001, Alternatives Considered), so the demo runs the real use cases and presenters.
- No web code exists: `apps/web` holds the wireframe files only and is not a workspace package (`06-architecture.md` §4).
- Open (FE): how the demo build reaches the portfolio site (copy of the static output, a separate repository or a deploy step). No ADR decides it, and ADR-006 point 10 rules out continuous deployment. Recommendation: settle it in the frontend-stage ADR (ADR-010 point 6).
- `12-demo-mode-spec.md` has not been reconciled yet and still describes the demo as "mock infrastructure" (T5.1, `12` last).

---

# 23. Demo vs Real Infrastructure

**Status:** per item (table below)

Application and domain behavior should remain shared.

```text
                    Application
                         │
                ┌────────┴────────┐
                │                 │
             Demo              Real
                │                 │
         Mock adapters       Real adapters
                │                 │
        Simulation          API/PostgreSQL
```

The composition root selects the infrastructure.

| Item | Status |
|---|---|
| Domain behavior shared by both | `Implemented`: `packages/domain` |
| Application layer shared by both | `Planned (B0)`: `@trading/application` does not exist yet (ADR-001 point 1) |
| Real adapters: Prisma repositories and the API | `Implemented`: `packages/database`, `apps/api`; the API wires them without a composition root today |
| Real composition root | `Planned (B0)`: `apps/api/src/composition.ts` (ADR-001 point 4) |
| Demo adapters: in-memory repositories and `UnitOfWork`, in-process `TradingClient`, market simulation | `Planned (FE)`; `@trading/market-sim` `Planned (B5)` |
| Demo composition root and mode selection through `APP_MODE` / `VITE_APP_MODE` | `Planned (FE)` (ADR-001 point 4; ADR-006 point 8) |

Code vs ADR:

- Today the services in `apps/api/src/services/` import the Prisma repositories directly, so the shared application layer in the diagram does not exist yet. ADR-001 moves them into `@trading/application` in B0.
- The "Mock adapters" and "Simulation" boxes are in-memory repositories and the shared `@trading/market-sim` engine. They are not a second implementation of the use cases.
- Open (FE): whether `VITE_APP_MODE` is read at build time (one bundle per mode) or at runtime (one bundle that selects its adapters). ADR-006 point 8 only names the variable. Recommendation: build time, so the public demo bundle contains no HTTP adapter and no API base URL.

---

# 24. Public Demo Safety

**Status:** `Planned (FE)`; resource bounds and demo diagnostics `Deferred`

The public demo must not expose:

- server credentials
- private database access
- administrative operations
- development stack traces
- unrestricted diagnostic information
- private data

Public demo simulations must have bounded resource usage.

| Exposure | How the decided design avoids it | Status |
|---|---|---|
| Server credentials | The build calls no backend and carries no secrets; only `VITE_`-prefixed values reach it, none of them secret (ADR-006 point 7; §14) | `Planned (FE)` |
| Private database access | There is no server and the build has no `DATABASE_URL` | `Planned (FE)` |
| Administrative operations | No server operation exists to expose. The role selector (Viewer, Trader, Admin) runs the same permission checks in process, and `ADMIN` adds only `simulation:control`, which acts on the in-browser simulator (ADR-005 points 11 and 13) | `Planned (FE)` |
| Development stack traces | The error envelope carries `code`, `message`, `requestId` and optional `details`, never a stack (ADR-002 point 2) | `Planned (FE)` |
| Unrestricted diagnostic information | No diagnostics interface is decided (`13-observability-spec.md` §30, `12-demo-mode-spec.md` §75) | `Deferred` |
| Private data | The demo bundles synthetic data only; the data layers are not decided (ADR-010 point 6) | `Deferred` |
| Bounded simulation resources | No ADR sets a bound for the in-browser simulation | `Deferred` |

Code vs ADR:

- The security view is `09-security-spec.md` §41 and `12-demo-mode-spec.md` §58-59. In the demo, the use-case checks give parity with the real API, not security, because no server enforces them (NFR-026; `09-security-spec.md` §47).
- The headers of the static host are outside this project's control (NFR-025 accepted exception; `09-security-spec.md` §25).
- Open (FE): the numeric bound of the demo simulation, for example a cap on retained ticks and events. ADR-007 point 8 bounds retention in real mode only. Recommendation: decide it in the frontend-stage ADR with the demo specifics.

---

# 25. Backend Deployment

**Status:** runnable artifact `Planned (B7)`; deployment to a host `Deferred` (ADR-006 point 2)

The backend must be deployable as a standalone Node.js service or Docker container.

The runtime artifact should contain:

- compiled application
- production dependencies
- runtime configuration

Development-only dependencies should not be required in production.

| Item | Status |
|---|---|
| Compiled application: every package compiles to `dist` and exposes it through `exports`; the API runs with `node dist/index.js` | `Planned (B7)` (ADR-006 point 3) |
| Standalone Node.js service on the author's machine | `Planned (B7)`: the `start` script of `apps/api` exists, but the output does not run today |
| Docker container | `Planned (B7)`: the `full` Compose profile (§26; ADR-006 point 4) |
| Production dependencies only | `Planned (B7)`; how they are separated is open |
| Runtime configuration through environment variables | `Implemented` (§10, §12) |
| Deployment to a hosting provider | `Deferred`; a new ADR is needed (ADR-006 point 2) |

Code vs ADR:

- `pnpm build` compiles the packages, but `@trading/domain` and `@trading/database` set `main` to `./src/index.ts` and the domain uses extensionless relative imports, so `node dist/index.js` cannot resolve them (ADR-006 context). `apps/api` sets `main` to `./src/index.ts` as well.
- The `start` script loads `../../.env` through `dotenv-cli`, which suits a local run. How a container receives its variables is open (B7).
- Open (B7): how production dependencies are separated from development ones in the image. Recommendation: decide it with the Dockerfile in B7 (ADR-006 point 3 leaves the details to B7).

---

# 26. Backend Container

**Status:** `Planned (B7)`; the PostgreSQL service and its healthcheck `Implemented`

A production container should prioritize:

- reproducibility
- predictable startup
- minimal runtime dependencies
- non-root execution where practical
- health checks
- graceful shutdown

A multi-stage Docker build should be considered:

```text
Build stage
 ├── install
 ├── type check
 └── build

Runtime stage
 ├── production dependencies
 └── compiled application
```

| Priority | Status |
|---|---|
| Multi-stage build, decided rather than "considered" | `Planned (B7)` (ADR-006 point 4) |
| Non-root execution, decided rather than "where practical" | `Planned (B7)` (ADR-006 point 4; `09-security-spec.md` §38) |
| Predictable startup: PostgreSQL healthy before `migrate deploy` and the API | `Planned (B7)`: `depends_on` with `condition: service_healthy` (ADR-006, Deferred detail) |
| Health checks: PostgreSQL | `Implemented`: `pg_isready` in `docker-compose.yml` |
| Health checks: API container | `GET /health` and `GET /health/ready` exist; a container healthcheck is not decided (open, B7) |
| Graceful shutdown | `Planned (B3)` (§16; ADR-006 point 12) |
| Reproducibility and minimal runtime dependencies | `Planned (B7)`; base-image pinning and the dependency split are open |
| `full` Compose profile (PostgreSQL and the API) | `Planned (B7)` (ADR-006 point 4) |

Code vs ADR:

- `docker-compose.yml` defines one service, `postgres` (`postgres:18`), with no profiles. `docker/` holds a `.gitkeep` only, and no Dockerfile exists.
- Open (B7): where the Dockerfile lives (`docker/` or `apps/api/`). Recommendation: `apps/api/Dockerfile` with the workspace root as build context, since the image needs the workspace packages.
- Open (B7): the entrypoint must pass `SIGTERM` to the Node process, otherwise the shutdown of ADR-006 point 12 never runs in a container. Recommendation: run `node dist/index.js` directly as the container command, with no `pnpm` or shell wrapper.
- The Postgres port binding and the superuser database role are in `09-security-spec.md` §36 and §38 and ADR-005 point 13 (§30).

---

# 27. Frontend Production Build

**Status:** `Planned (FE)`

The frontend should produce static assets:

```text
React source
    ↓
Vite build
    ↓
Static assets
    ↓
Static hosting / web server
```

A Node.js runtime is not required to serve static assets unless the selected deployment architecture chooses one.

| Item | Status |
|---|---|
| Vite build to static assets | `Planned (FE)` (`04-tech-stack.md` §5; ADR-006 points 1 and 8) |
| Configurable base path, for the subpath of the portfolio site | `Planned (FE)` (ADR-006 point 7) |
| SPA fallback | `Planned (FE)` (ADR-006 point 7) |
| `VITE_APP_MODE=demo` at build time, no secrets in the build | `Planned (FE)` (ADR-006 points 7 and 8) |
| Real-mode web app against the local API | `Deferred`: how it runs and receives the API URL is not decided (§14) |

Code vs ADR:

- `apps/web` is not a workspace package, so `pnpm build` (`pnpm -r build`) does not cover it today.
- The demo needs no Node.js runtime: its host serves static files (ADR-006 point 7). The `full` profile has no web service (ADR-006 point 4), so the real-mode web app is not served by the stack. Recommendation: run it with the Vite development server against the local API, and decide it in the frontend-stage ADR.

---

# 28. Frontend Hosting

**Status:** the demo under the portfolio site `Planned (FE)`; any other provider `Deferred`

The frontend should be compatible with free/static hosting.

Required characteristics:

- HTTPS
- static assets
- SPA fallback where necessary
- configurable API origin
- Git-based deployment where useful

The architecture must not depend on one specific hosting provider.

| Characteristic | Status |
|---|---|
| HTTPS | `Planned (FE)`: expected from the portfolio site, which this project does not control; no ADR names the host |
| Static assets | `Planned (FE)` (ADR-006 point 7) |
| SPA fallback | `Planned (FE)` (ADR-006 point 7); how the host provides it is open |
| Configurable API origin | Not needed by the public demo, which calls no backend (ADR-006 point 7); for the real mode `Deferred` (§14) |
| Git-based deployment | `Deferred`: ADR-006 point 10 excludes continuous deployment, and the way the build reaches the host is open (§22) |

Code vs ADR:

- ADR-006 decides the hosting model, a subpath of the author's portfolio site (context and point 7), and names no provider. This section therefore names none.
- Open (FE): confirm that the portfolio host serves HTTPS and a SPA fallback for the subpath. Recommendation: record the confirmation in the frontend-stage ADR.

---

# 29. Backend Hosting

**Status:** `Deferred`: no backend is hosted (ADR-006 point 2)

The backend requires a runtime that supports:

- Node.js or Docker
- HTTP
- WebSockets
- environment variables/secrets
- PostgreSQL connectivity
- health checks

Before actual deployment, current provider limits and WebSocket support must be verified.

No provider should be presented as permanently free because hosting policies can change.

Code vs ADR:

- The list above is kept as input for the ADR that hosting would need (ADR-006 point 2). It is a requirement list, not a plan.
- The local full stack meets it with Node.js, Docker Compose and PostgreSQL on the author's machine (ADR-006 points 1 and 4).
- Every provider, plan and limit is `Deferred`. The rule about free tiers stays as a rule: no decision may assume a paid plan, and none may assume a free one lasts (`04-tech-stack.md` §49).

---

# 30. Database Hosting

**Status:** local PostgreSQL `Implemented`; managed PostgreSQL `Deferred` (ADR-006 point 2)

Local:

```text
PostgreSQL → Docker
```

Public/production-like:

```text
Application → Managed PostgreSQL
```

A free development tier may be preferred, but the architecture remains provider-agnostic.

| Item | Status |
|---|---|
| PostgreSQL in Docker | `Implemented`: service `postgres`, image `postgres:18`, named volume `trading-analytics-postgres-data`, `pg_isready` healthcheck (`docker-compose.yml`) |
| Managed PostgreSQL | `Deferred` |
| Backups | Not applicable to a local environment, and not claimed (ADR-006 point 9) |

Code vs ADR:

- The "Public/production-like" diagram does not apply: the production-like target is the same local PostgreSQL (ADR-006 points 1 and 4), so no application connects to a managed database.
- Compose publishes PostgreSQL on `${DATABASE_PORT:-5432}` without a bind address, and the API, migrations and tests connect as the image's superuser. A `127.0.0.1` binding is open (B7), and the separate runtime role is `Planned (B0)` (`09-security-spec.md` §36 and §38; ADR-005 point 13).
- The default Compose profile keeps only PostgreSQL (ADR-006 point 4).

---

# 31. WebSocket Deployment

**Status:** local WebSocket `Planned (B5)` (ADR-007); hosted requirements `Deferred`

The selected deployment environment must support:

- persistent WebSocket connections
- connection upgrades
- appropriate timeout behavior
- reconnects
- required proxy configuration

If a provider cannot reliably support WebSockets, it is not a valid target for the realtime production-like deployment.

Local Docker must remain a reliable fallback.

| Requirement | Status |
|---|---|
| Persistent connections and upgrades | `Planned (B5)`: the `ws` library behind a transport port (ADR-007 point 1) |
| Timeout behavior | `Planned (B5)`: heartbeat with a ping every 30 seconds, and a socket closed after 2 consecutive missed pongs (`08-realtime-spec.md` §7) |
| Reconnects | `Planned (FE)` (`08-realtime-spec.md` §27) |
| Proxy configuration | `Deferred`: the local stack has no proxy (§32) |
| Provider support | `Deferred` (ADR-006 point 2) |

Code vs ADR:

- No WebSocket code exists. The "provider" and "production-like deployment" wording applies to a hosted backend, which ADR-006 point 2 defers. The production-like target is the local full stack, which stays the only target.
- Open (B5): the endpoint path, and whether the WebSocket server shares the HTTP port. The variable `WEBSOCKET_PATH` is not adopted (§10). Recommendation: attach it to the same HTTP server and port (7001) with a fixed path, so the full stack publishes one port.

---

# 32. Reverse Proxy

**Status:** `Deferred` (ADR-006 point 2)

A reverse proxy may provide:

```text
Browser
   ↓
HTTPS / WSS
   ↓
Reverse Proxy
   ↓
Backend
```

A dedicated proxy is not mandatory if the hosting platform already provides equivalent routing and TLS behavior.

Code vs ADR:

- No proxy exists or is planned. In the local stack the browser calls the API directly on `PORT` (default 7001), and the `full` profile adds the API to PostgreSQL with no proxy service (ADR-006 point 4). The demo is static files served by its host.
- `apps/api/src/app.ts` does not set `trust proxy`, and the rate limiters key on the client IP (`apps/api/src/middleware/rate-limit.ts`). Behind a proxy every client would share the proxy's address. This matters only for the ADR that would host the backend.

---

# 33. CORS

**Status:** `Implemented` (`apps/api/src/app.ts`, `apps/api/src/config/env.ts`); credentials `Planned (B2)`; `X-Request-ID` exposure `Planned (B3)`

CORS must be explicit.

Development may allow the local frontend origin.

Production should allow only configured trusted origins.

Avoid wildcard CORS for authenticated APIs unless there is a specific, justified requirement.

| Item | Status |
|---|---|
| Explicit origins from `CORS_ORIGIN`, a comma-separated list | `Implemented`: `cors({ origin: env.CORS_ORIGIN })` |
| Development origin | `Implemented`: default `http://localhost:5173` |
| Production origins | `Implemented` through the same variable (local `production`) |
| No wildcard | `Implemented`: the code never sets `*` (`09-security-spec.md` §24) |
| Credentials for the refresh cookie | `Planned (B2)` (ADR-005 Consequences) |
| `X-Request-ID` readable by the browser | `Planned (B3)`: `exposedHeaders` (ADR-009 point 5) |
| Public demo | No entry needed: it calls no backend (ADR-006 point 7) |

Code vs ADR:

- `request-id.ts` sets `X-Request-ID` on every response, but the CORS configuration has no `exposedHeaders` and no `credentials`, so a browser on another origin cannot read the header today and sends no cookies.
- The default origin also applies when `NODE_ENV=production` and `CORS_ORIGIN` is unset. `env.ts` does not check that each entry is a well-formed origin and does not reject `*`.
- Open (B0): validate each `CORS_ORIGIN` entry in `env.ts`. Recommendation: accept only `http(s)://host[:port]` origins and reject `*`.
- Open (B5): whether the WebSocket upgrade also checks `Origin` against `CORS_ORIGIN` (`09-security-spec.md` §31).

---

# 34. HTTPS and WebSockets

**Status:** public HTTPS for the demo is provided by its host; the local stack uses HTTP and `ws://`; public WSS `Deferred` (ADR-006 point 2)

Public environments must use HTTPS.

Corresponding realtime transport should use:

```text
HTTPS → WSS
```

Mixed-content requests must be avoided.

| Environment | Transport | Status |
|---|---|---|
| Public demo | HTTPS from the portfolio host, no backend, no realtime socket | `Planned (FE)` |
| Local full stack | `http://localhost:7001` and `ws://` | `Implemented` for HTTP; `ws://` `Planned (B5)` |
| Public backend | HTTPS and WSS | `Deferred` |

Code vs ADR:

- The only public environment is the static demo, so "public environments must use HTTPS" reduces to the host serving it (§28). The demo never requests a local or insecure URL, which keeps mixed content out (ADR-006 point 7).
- The local stack has no HTTPS (`09-security-spec.md` §3, §31). `helmet` still sends `Strict-Transport-Security`, which has no effect over plain HTTP (`09-security-spec.md` §25).
- The refresh cookie is `Secure` (ADR-005 point 5) and the local stack has no HTTPS. Open (B2): serve on `localhost`, which browsers treat as secure, or make `Secure` environment-dependent (ADR-005, Deferred detail).

---

# 35. Authentication Deployment

**Status:** per item (table below)

JWT authentication requires a server-side signing secret.

Requirements:

- secret supplied at runtime
- never exposed to frontend
- expiration configured
- server-side validation
- safe authentication logging
- secure deployment configuration

Changing the signing secret should be treated as an operational event.

| Requirement | Today | Status |
|---|---|---|
| Secret supplied at runtime | `JWT_SECRET` from the environment, at least 32 characters, no default (`apps/api/src/config/env.ts`) | `Implemented` |
| Never exposed to the frontend | No endpoint returns it and `env.ts` prints keys, not values; the web build carries no secret (§14) | `Implemented` for the API; `Planned (FE)` for the build |
| Expiration configured | `JWT_EXPIRES_IN_SECONDS`, default 900 (ADR-005 point 4) | `Implemented` |
| Server-side validation | `authenticate.ts` verifies signature and expiry, and answers one generic 401 | `Implemented` |
| Safe authentication logging | No authentication entries exist; redaction and the `auth.*` entries come with the `Logger` (ADR-009 points 4 and 11) | `Planned (B3)` |
| Secure deployment configuration | Local only (§13); `NODE_ENV=production` adds no rule to the schema (§12) | `Implemented` as the minimum length |

Code vs ADR:

- `09-security-spec.md` §7-8 covers token lifetime and storage. Refresh tokens and sessions are `Planned (B2)` (ADR-005 points 5-6).
- Changing `JWT_SECRET` invalidates every access token still in circulation, at most 15 minutes of them. From B2 the refresh tokens stay valid, because they are opaque values stored hashed in the sessions table and not signed with this secret (ADR-005 point 5). No ADR decides a rotation procedure, such as overlapping secrets. With one local API, restarting with a new secret is the whole procedure.

---

# 36. RBAC Deployment

**Status:** `Reference` for the principle; backend enforcement `Planned (B0)` and `Planned (B2)`; frontend checks `Planned (FE)`

Authorization is a backend security boundary.

```text
Frontend role check
    → UX convenience

Backend role check
    → Security enforcement
```

Frontend visibility cannot replace backend authorization.

Code vs ADR:

- The roles differ. `UserRole` in `packages/database/prisma/schema.prisma` is `USER` and `ADMIN`, with `@default(USER)`, and the seed creates one `USER`. ADR-005 point 1 sets `VIEWER`, `TRADER` and `ADMIN`, with `USER` migrated to `TRADER` in B2 (`09-security-spec.md` §12).
- No route checks the role. `authenticate.ts` copies `role` from the token into `req.auth`, and nothing reads it. ADR-005 point 3 puts the check in the application layer, with an `Actor { userId, role }`, which depends on `@trading/application` (B0).
- Nothing in the deployment differs between environments: the role is read from the database at login and by `GET /auth/me`, then carried in the token (ADR-005 point 9), so no variable or build flag grants a role.
- The demo has no server, so its role selector gives behavior parity, not security (ADR-005 point 11; `09-security-spec.md` §47; NFR-026).

---

# 37. Build Reproducibility

**Status:** per item (table below)

Builds should use:

- committed lockfile
- explicit Node.js version
- consistent package manager
- deterministic commands
- shared TypeScript configuration

The Node.js version should target a current supported LTS release when implementation begins.

| Item | Today | Status |
|---|---|---|
| Committed lockfile | `pnpm-lock.yaml` is tracked | `Implemented` |
| Explicit Node.js version | `engines.node` is `>=22.0.0` in the root `package.json`; there is no `.nvmrc` or `.node-version` | `Implemented` as a range; a pinned version `Planned (B0)`, open |
| Consistent package manager | `packageManager` is `pnpm@12.3.4`; `engines.pnpm` is `>=9.0.0` (`04-tech-stack.md` §37) | `Implemented` |
| Deterministic commands | Root scripts `build`, `test`, `typecheck`, `lint`, `format:check` and `docs:check` | `Implemented` |
| Install from the lockfile on a clean checkout | The GitHub Actions workflow (ADR-006 points 10 and 11) | `Planned (B0)` |
| Shared TypeScript configuration | `tsconfig.base.json`, extended by `apps/api`, `packages/domain` and `packages/database`; the root `tsconfig.json` references the three | `Implemented` |
| Pinned container base images | The `full` profile does not exist yet; `docker-compose.yml` pins `postgres:18` to the major version | `Planned (B7)`, open |

Code vs ADR:

- The sentence about an LTS release was written before implementation. The code targets Node.js 22 or later. Which line the CI and the image use is open (B0, B7). Recommendation: pin one line in `.nvmrc` and use it in CI and the Dockerfile.
- Versions differ across packages: `typescript` is `^5.7.3` in `packages/domain` and `packages/database` but `^6.0.3` at the root and in `apps/api`, and `@types/node` is `^22.20.2` in `apps/api` but `^26.4.1` elsewhere. This is the open detail of `04-tech-stack.md` (B0).
- `engines.pnpm >=9.0.0` admits versions older than the `pnpm@12.3.4` that produced the lockfile. Recommendation: align it with `packageManager` in B0.

---

# 38. Package Management

**Status:** `Implemented`; CI install strategy `Planned (B0)`

One package manager must be selected and documented.

The lockfile must be committed.

Local and CI environments should resolve dependencies using the same strategy.

| Item | Status |
|---|---|
| One package manager: pnpm workspaces over `apps/*` and `packages/*` (`pnpm-workspace.yaml`), documented in `04-tech-stack.md` §37 | `Implemented` |
| Lockfile committed: `pnpm-lock.yaml` | `Implemented` |
| Install scripts restricted: `allowBuilds` allows only Prisma and `esbuild` | `Implemented` |
| CI resolves dependencies from the lockfile, as locally | `Planned (B0)` (ADR-006 point 10) |

Code vs ADR:

- No CI exists, so the "same strategy" is untested until the workflow is added. `.github/` holds only the pull request template.
- Workspace packages are linked with `workspace:*` (`apps/api/package.json`, `packages/database/package.json`).

---

# 39. Repository Structure

**Status:** `Implemented` for the current tree; new packages `Planned (B0)` and `Planned (B5)`

If frontend and backend share a repository, their boundaries should be explicit.

Conceptual structure:

```text
/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── shared/
│   └── config/
├── docs/
├── docker/
├── scripts/
└── package.json
```

The exact structure belongs to `15-implementation-plan.md` and implementation.

| Path in the diagram | Real tree | Status |
|---|---|---|
| `apps/api` | `@trading/api` | `Implemented` |
| `apps/web` | Wireframe files only; not a workspace package | `Planned (FE)` |
| `packages/shared` | Not adopted. Its role is split between `@trading/domain` (rules and types) and `@trading/contracts` (wire types) | `@trading/contracts` `Planned (B0)` (ADR-002) |
| `packages/config` | `.gitkeep` only | `Deferred` (`06-architecture.md` §4) |
| `docs/`, `scripts/` | SDD and ADRs; `scripts/check-docs.mjs` | `Implemented` |
| `docker/` | `.gitkeep` only | `Planned (B7)`: the Dockerfile location is open (§26) |
| `package.json` | Root manifest and scripts | `Implemented` |
| Not in the diagram | `packages/domain` and `packages/database` `Implemented`; `packages/application` `Planned (B0)` (ADR-001); `@trading/market-sim` `Planned (B5)`, path not fixed (ADR-007 point 7) | per package |

Code vs ADR:

- The current tree and the package states live in `06-architecture.md` §4 and `04-tech-stack.md` §38. The diagram is conceptual and is not the structure to follow. `15-implementation-plan.md` is aligned in T5.2.
- Boundaries are enforced today by `package.json` dependencies and project references only. The import-restriction lint rule is commented out in `eslint.config.js` and is `Planned (B0)` (ADR-001; NFR-011).

---

# 40. Shared Types

**Status:** `Planned (B0)` for `@trading/contracts`; domain types `Implemented`

Shared TypeScript contracts should originate from API/domain boundaries, not from UI implementation.

Preferred:

```text
API contract
    ├── backend
    └── frontend
```

Avoid making backend domain code depend on frontend types.

| Item | Status |
|---|---|
| Domain types and enums shared through `@trading/domain` | `Implemented` |
| `@trading/contracts`: request and response schemas, error envelope, pagination `meta` and the inferred DTO types | `Planned (B0)` (ADR-002 points 1 and 2) |
| The web app consumes DTOs through the `TradingClient` port, with an HTTP adapter (real) and an in-process adapter (demo) | `Planned (FE)` (ADR-002 point 5) |

Code vs ADR:

- The "API contract" box is `@trading/contracts`. It depends on `zod` and on `@trading/domain` for types and enum values only (ADR-002 point 1). `packages/contracts` holds a `.gitkeep` only.
- Today only requests are typed: the Zod schemas live in `apps/api/src/schemas/`, where no frontend can import them, and responses have no declared shape (ADR-002 context).
- The last rule holds: `@trading/domain` depends on `decimal.js` only (`packages/domain/package.json`), so no frontend type can reach it.

---

# 41. CI Pipeline

CI should validate meaningful changes.

Recommended pipeline:

```text
Install
  ↓
Lint
  ↓
Type Check
  ↓
Unit Tests
  ↓
Integration Tests
  ↓
Build
  ↓
E2E Tests
  ↓
Artifact validation
```

Execution order may be optimized for speed.

---

# 42. CI Database

Integration tests must use an isolated disposable PostgreSQL instance.

Possible approaches:

- Docker service
- CI PostgreSQL service
- test container

CI must never use a production database.

---

# 43. CI Environment

CI should define:

- Node.js version
- package manager
- test mode
- database configuration
- deterministic seed data
- required non-secret variables

Secrets should use the CI platform's secret store if necessary.

---

# 44. Build Artifacts

CI may produce:

- frontend build
- backend build
- Docker image
- test reports
- coverage reports

Generated artifacts should not be committed to Git.

---

# 45. Deployment Pipeline

A simple deployment flow:

```text
Git push
   ↓
CI validation
   ↓
Build
   ↓
Package/artifact
   ↓
Deploy
   ↓
Database migration
   ↓
Health check
   ↓
Smoke test
```

The pipeline should remain simple enough to maintain independently.

---

# 46. Deployment Ordering

Deployment must consider compatibility between:

- application version
- database schema
- API contract
- frontend version

Where practical, migrations should support compatibility during rollout.

Complex zero-downtime orchestration is not required for the initial project.

---

# 47. Rollback

Rollback must be considered separately for:

### Application

Redeploy a known-good artifact.

### Frontend

Restore a previous static build.

### Database

Rollback only when safe and supported by the migration/data model.

Database rollback is not automatically equivalent to application rollback.

---

# 48. Deployment Verification

A deployment is not successful merely because a process starts.

Verify:

```text
Frontend loads
    ↓
API reachable
    ↓
Database ready
    ↓
Authentication works
    ↓
Core API flow works
    ↓
WebSocket connects
    ↓
Health reports expected state
```

---

# 49. Smoke Tests

Minimum smoke tests should verify:

1. frontend accessibility
2. API health
3. authentication
4. authenticated request
5. primary portfolio flow
6. realtime connection
7. expected error handling

---

# 50. Health Checks

The deployment must preserve the health model from `13-observability-spec.md`.

Recommended endpoints:

```text
GET /health
GET /health/ready
```

Liveness should answer whether the process is alive.

Readiness should answer whether required dependencies are available.

Health responses must never expose credentials or internal secrets.

---

# 51. Container Health

A container can be running while the application is unusable.

Therefore health checks should distinguish:

```text
Process running
```

from:

```text
Application ready
```

The deployment platform should use readiness information where supported.

---

# 52. Startup Diagnostics

Startup should produce safe structured events such as:

```text
service.starting
configuration.validated
database.connected
application.initialized
http.ready
websocket.ready
service.ready
```

Startup failures must be visible through the observability system.

---

# 53. Observability During Deployment

Deployment must preserve:

- structured logs
- request IDs
- error diagnostics
- health checks
- metrics where implemented
- realtime diagnostics

See `13-observability-spec.md`.

A deployment that cannot be diagnosed is incomplete.

---

# 54. Background Jobs

If background jobs execute in the API process, deployment must account for:

- graceful shutdown
- duplicate execution
- cancellation
- timeouts
- process restarts

A future worker architecture may be:

```text
API
 ↓
Queue
 ↓
Worker
```

A separate worker is not required initially unless justified.

---

# 55. Demo Background Jobs

Demo jobs must not require a production queue service.

They should use the simulation infrastructure from `12-demo-mode-spec.md` and still demonstrate:

- progress
- completion
- failure
- cancellation
- timeout

---

# 56. Demo Persistence

Demo state should remain isolated from production data.

The public demo should not be able to modify:

- real user records
- real portfolios
- real database state
- private application data

---

# 57. Local Production-like Mode

A production-like local mode should validate:

- production builds
- environment variables
- containers
- migrations
- health checks
- realtime
- startup/shutdown

Conceptually:

```text
Docker Compose
 ├── frontend build
 ├── backend build
 ├── PostgreSQL
 └── production configuration
```

---

# 58. Dependency Security

The project should:

- commit lockfiles
- review dependency updates
- remove unused packages
- run vulnerability checks when practical
- keep production dependencies minimal

No dependency should be added only for appearance.

---

# 59. Runtime Versions

Node.js and PostgreSQL versions must be explicitly documented and pinned for local development.

The versions should be selected from currently supported releases when implementation begins.

Local, CI and production-like environments should remain compatible.

---

# 60. Time and Timezone

The deployment environment should use UTC where practical.

Recommended strategy:

- store timestamps in UTC
- serialize consistently
- convert to user-local time in the UI
- do not depend on server-local timezone

This is important for trading data and historical analytics.

---

# 61. File Handling

If files are generated or delivered:

```text
Generate
  ↓
Deliver
  ↓
Cleanup
```

Ephemeral container storage must not be treated as durable storage.

Persistent file storage should be introduced through an infrastructure adapter if required later.

---

# 62. External APIs

External market-data services are optional.

If introduced:

```text
Application
    ↓
Market Data Adapter
    ↓
Provider
```

Credentials remain server-side.

Demo Mode must not depend on external market-data availability.

---

# 63. Rate Limiting

Rate limiting should be considered for:

- authentication
- expensive analytics
- public endpoints
- resource-intensive operations

Exact limits should be based on the deployed environment and validated during implementation.

Rate limiting must not break local development or CI.

---

# 64. Public Demo Traffic

Public traffic must be treated as untrusted.

The application should protect against:

- arbitrary file access
- unauthorized administration
- private data access
- uncontrolled resource consumption
- abusive simulation requests

Demo resources should remain bounded.

---

# 65. Resource Limits

Reasonable limits should exist for:

- request body size
- upload size if applicable
- pagination size
- analytics query scope
- background job duration
- realtime history
- demo history
- database query limits

These limits protect both local and public deployments.

---

# 66. Database Pooling

The backend should use controlled PostgreSQL connection pooling.

Pool size must reflect the actual deployment capacity.

It should not exceed what the database instance can safely support.

Exact values are implementation decisions, not universal performance guarantees.

---

# 67. Horizontal Scaling

The initial backend may run as a single instance.

The architecture should nevertheless avoid unnecessary process-local assumptions.

Future topology:

```text
Load Balancer
 ├── API 1
 ├── API 2
 └── API 3
       │
       ▼
   PostgreSQL
```

Realtime scaling may later require shared coordination.

---

# 68. Realtime Scaling Boundary

A multi-instance WebSocket deployment may require a shared event mechanism:

```text
API instances
      ↓
Realtime broker/pub-sub
      ↓
Connected clients
```

The current realtime implementation should remain behind an abstraction to permit this evolution.

---

# 69. CDN and Static Assets

The frontend should be compatible with CDN/static hosting.

Use:

- content-hashed assets
- cacheable immutable files
- controlled HTML caching
- explicit API origin configuration

Exact caching headers depend on the host.

---

# 70. SPA Routing

Static hosting must support client-side routes such as:

```text
/dashboard
/portfolio/123
/analytics
```

Unknown application paths should resolve to the frontend entry point rather than a server 404.

The required host-specific fallback must be documented.

---

# 71. API Versioning

The API should have a consistent versioning strategy.

A possible initial strategy:

```text
/api/v1/...
```

Final routes must remain aligned with `07-api-spec.md`.

---

# 72. WebSocket Configuration

The WebSocket endpoint must be environment-aware.

Conceptually:

```text
Development:
ws://localhost:<port>/<path>

Production:
wss://<configured-domain>/<path>
```

The exact endpoint is finalized during implementation.

---

# 73. Backups

Local development does not require formal backups.

A production-like persistent deployment should have a documented backup and restoration strategy if real user data exists.

The project must not claim backup coverage until it has actually been configured and tested.

---

# 74. Disaster Recovery

Enterprise disaster recovery is out of scope.

A practical recovery sequence should nevertheless be documented:

```text
Restore database
   ↓
Run compatible application
   ↓
Validate migrations
   ↓
Start services
   ↓
Health checks
   ↓
Smoke tests
```

---

# 75. Troubleshooting

Documentation should cover common failures.

### Database unavailable

Check:

- PostgreSQL service
- connection URL
- credentials
- network
- readiness

### Backend does not start

Check:

- environment variables
- Node.js version
- build output
- migration state
- logs

### Frontend cannot reach API

Check:

- API base URL
- CORS
- backend health
- browser network panel

### WebSocket fails

Check:

- endpoint
- WS/WSS scheme
- proxy support
- server upgrade support
- browser console
- reconnect diagnostics

---

# 76. Local Setup

The documented setup should follow approximately:

```text
Clone
 ↓
Install dependencies
 ↓
Create environment file
 ↓
Start PostgreSQL
 ↓
Run migrations
 ↓
Seed development data
 ↓
Start backend
 ↓
Start frontend
 ↓
Open application
```

Exact commands belong in repository documentation.

---

# 77. Production Setup

Production-like deployment should follow:

```text
Provision infrastructure
 ↓
Configure secrets
 ↓
Build artifacts
 ↓
Run migrations
 ↓
Start backend
 ↓
Deploy frontend
 ↓
Verify health
 ↓
Verify realtime
 ↓
Run smoke tests
```

---

# 78. Security Checklist

Before public deployment:

- [ ] No secrets committed
- [ ] Production JWT secret configured
- [ ] Database credentials protected
- [ ] CORS restricted
- [ ] HTTPS enabled
- [ ] Debug mode disabled
- [ ] Stack traces hidden
- [ ] Health output sanitized
- [ ] Metrics restricted if exposed
- [ ] Admin operations protected
- [ ] Rate limits considered
- [ ] Resource limits configured
- [ ] Demo data isolated
- [ ] Dependencies reviewed

---

# 79. Performance Checklist

Before deployment:

- [ ] Production frontend build succeeds
- [ ] Production backend build succeeds
- [ ] Development dependencies excluded where appropriate
- [ ] Static assets optimized
- [ ] Required indexes exist
- [ ] Pagination limits enforced
- [ ] Realtime history bounded
- [ ] Background jobs have timeouts
- [ ] Logging volume controlled

No performance claim should be published without actual measurement.

---

# 80. Deployment Observability Checklist

Verify:

- [ ] startup logs
- [ ] request IDs
- [ ] error logging
- [ ] health endpoint
- [ ] readiness checks
- [ ] database health
- [ ] realtime lifecycle diagnostics
- [ ] background job diagnostics
- [ ] metrics where implemented
- [ ] safe production log level

---

# 81. Deployment Testing Matrix

| Test | Local | CI | Demo | Production-like |
|---|---:|---:|---:|---:|
| Unit | ✓ | ✓ | - | - |
| Integration | ✓ | ✓ | - | ✓ |
| E2E | ✓ | ✓ | ✓ | ✓ |
| Migrations | ✓ | ✓ | N/A/isolated | ✓ |
| Health | ✓ | ✓ | ✓ | ✓ |
| Realtime | ✓ | ✓ | ✓ | ✓ |
| Demo simulation | ✓ | ✓ | ✓ | Optional |
| Production build | ✓ | ✓ | ✓ | ✓ |
| Smoke tests | Optional | Optional | ✓ | ✓ |

---

# 82. Deployment Acceptance Criteria

The architecture is acceptable when:

1. A new developer can run the application using documented steps.
2. PostgreSQL starts reproducibly.
3. Migrations are deterministic.
4. Backend and frontend can be built independently.
5. Configuration is externalized.
6. Secrets are not committed.
7. Health reflects real service state.
8. WebSockets work in the supported deployment environment.
9. Demo Mode works without paid external infrastructure.
10. CI validates the application from a clean environment.
11. Production-like builds can be tested locally.
12. Deployment failures can be diagnosed through observability.
13. Rollback considerations are documented.
14. The architecture is not tied to one hosting vendor.

---

# 83. Definition of Done

### Local
- [ ] Docker setup implemented
- [ ] PostgreSQL reproducible
- [ ] frontend starts
- [ ] backend starts
- [ ] WebSockets work
- [ ] environment setup documented

### Database
- [ ] migration system implemented
- [ ] seed process documented
- [ ] reset process documented
- [ ] database version pinned

### Build
- [ ] frontend production build works
- [ ] backend production build works
- [ ] lockfile committed
- [ ] runtime versions documented

### CI
- [ ] lint passes
- [ ] type checking passes
- [ ] unit tests pass
- [ ] integration tests pass
- [ ] build passes
- [ ] E2E strategy configured

### Deployment
- [ ] frontend target defined
- [ ] backend target defined
- [ ] database target defined
- [ ] secrets strategy documented
- [ ] health checks available
- [ ] smoke tests defined

### Realtime
- [ ] endpoint configurable
- [ ] WSS supported publicly
- [ ] hosting requirements documented
- [ ] reconnect behavior preserved

### Demo
- [ ] no paid infrastructure required
- [ ] infrastructure isolated
- [ ] simulation follows `12-demo-mode-spec.md`
- [ ] private infrastructure not exposed

### Operations
- [ ] graceful shutdown works
- [ ] startup failures are observable
- [ ] deployment verification documented
- [ ] troubleshooting documented

---

# 84. Deployment Tradeoffs

The initial architecture intentionally does **not** require:

- Kubernetes
- Terraform
- service meshes
- distributed queues
- dedicated observability clusters
- multi-region deployment
- autoscaling infrastructure
- dedicated worker fleets

These may be appropriate in a larger system, but adding them here would increase complexity without proportionate value.

The deployment should demonstrate sound engineering rather than infrastructure for its own sake.

---

# 85. Free / Low-Cost Strategy

The project should prioritize infrastructure that can run at no recurring cost during development and portfolio demonstration.

Hosting plans and free tiers can change, therefore:

- verify current limits before deployment
- do not claim permanent free hosting
- keep architecture provider-agnostic
- retain local Docker as the canonical fallback

Distinguish between:

```text
Architecture requirement
```

and:

```text
Current provider choice
```

---

# 86. Provider Selection Criteria

### Frontend

- static hosting
- HTTPS
- SPA fallback
- environment configuration
- Git deployment

### Backend

- Node.js/Docker
- HTTP
- WebSockets
- secrets
- health checks
- suitable resource limits

### Database

- PostgreSQL
- reliable connections
- appropriate limits
- free/development availability
- backups when required

Providers must be evaluated against actual project requirements.

---

# 87. Vendor Independence

Infrastructure integrations should be encapsulated.

The following must not require vendor-specific application logic unless isolated behind adapters:

- database
- realtime
- file storage
- observability
- external APIs

This preserves portability.

---

# 88. Architecture Relationship

Deployment reflects the application boundaries:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Infrastructure
     ↓
Deployment
```

Domain logic should not know whether it runs locally, in Docker, in a demo, or in a cloud environment.

---

# 89. Observability Relationship

Deployment must preserve the capabilities from `13-observability-spec.md`:

```text
Deployment
 ├── startup logs
 ├── request correlation
 ├── health
 ├── metrics
 └── runtime errors
```

Observability is part of deployment readiness.

---

# 90. Testing Relationship

The deployment artifact should be validated as an executable system:

```text
Build
 ↓
Test
 ↓
Package
 ↓
Run
 ↓
Health
 ↓
Smoke
```

This reduces the difference between “the code builds” and “the deployed system works.”

---

# 91. Demo Relationship

Demo deployment is a deployment target, not a separate product.

```text
Real:
API + PostgreSQL + WebSocket

Demo:
Mock API + browser persistence + simulated realtime
```

Application behavior remains conceptually aligned.

---

# 92. Technical Interview Demonstration

A concise deployment walkthrough should demonstrate:

1. Start local services.
2. Show frontend, backend and PostgreSQL.
3. Run/inspect migrations.
4. Open health endpoint.
5. Demonstrate realtime.
6. Trigger an observable operation.
7. Show production build.
8. Explain how the same architecture maps to public deployment.
9. Demonstrate Demo Mode as an infrastructure substitution.

This communicates engineering maturity without unnecessary cloud complexity.

---

# 93. Future Evolution

Possible future deployment capabilities:

- dedicated worker
- Redis/pub-sub
- managed observability
- container registry
- infrastructure as code
- automated backups
- zero-downtime deployments
- blue/green deployments
- horizontal API scaling
- CDN optimization
- managed secrets
- distributed tracing

These are future capabilities, not minimum requirements.

---

# 94. Final Deployment Principle

> **The environment may change; the application's engineering boundaries should not.**

The system should move through:

```text
Developer laptop
      ↓
Docker
      ↓
CI
      ↓
Demo
      ↓
Production-like environment
```

without rewriting the product.

Deployment is therefore treated as another infrastructure boundary.

The application remains focused on domain behavior and communicates with its environment through configuration and infrastructure adapters.

---

# 95. Final Deployment Model

```text
                         Git Repository
                              │
                              ▼
                         CI Pipeline
                              │
                    ┌─────────┴─────────┐
                    │                   │
                Validation            Build
                    │                   │
                    └─────────┬─────────┘
                              │
                        Deployable
                         Artifacts
                              │
               ┌──────────────┼──────────────┐
               │              │              │
             Local           Demo        Production
               │              │              │
          Docker stack   Demo adapters   Real adapters
               │              │              │
          PostgreSQL       Browser        PostgreSQL
          WebSocket       simulation      WebSocket
          API             persistence     external infra
```

The deployment strategy demonstrates:

- reproducibility
- containerization
- environment separation
- database migrations
- secure configuration
- CI
- health checks
- realtime deployment
- graceful shutdown
- production awareness
- vendor independence

without introducing infrastructure whose complexity is not justified by the project.

---

# 96. Relationship to Other SDDs

This document depends on and complements:

- `00-overview.md` — project scope and principles
- `01-product-spec.md` — product behavior
- `02-functional-requirements.md` — functional requirements
- `03-non-functional-requirements.md` — quality attributes
- `04-tech-stack.md` — technical stack
- `06-architecture.md` — application architecture
- `07-api-spec.md` — API contracts
- `08-realtime-spec.md` — realtime architecture
- `09-security-spec.md` — security specification
- `10-testing-strategy.md` — testing strategy
- `11-ui-ux-spec.md` — UX behavior
- `12-demo-mode-spec.md` — demo infrastructure
- `13-observability-spec.md` — logs, metrics, health and diagnostics

The next document, `15-implementation-plan.md`, will translate the complete SDD set into an ordered implementation roadmap with phases, dependencies, milestones, validation points and delivery sequencing.

---

# Document Status

**Status:** Ready for implementation alignment

This document defines the target deployment architecture. Specific hosting providers, exact runtime versions, CI configuration, environment variable names and deployment commands may be finalized during implementation as long as they preserve the principles and acceptance criteria defined here.
