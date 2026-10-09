# SDD 14 — Deployment Specification

**Project:** Trading Analytics Platform  
**Document:** Deployment Specification  
**Version:** 1.0  
**Status:** All sections reconciled with the code and ADRs on 2026-10-07 (model and targets from ADR-006; graceful shutdown from ADR-006 point 12; the deployment decisions approved the same day from ADR-005 point 13, ADR-006 points 4, 8, 11-13, ADR-007 points 1 and 16, ADR-008 point 4, ADR-009 point 11 and ADR-010 point 6); open details are recorded per section  
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
| Production-like | Deployment validation | `Planned (B7)`: the local full stack, `full` Compose profile with PostgreSQL, a one-shot `migrate` service and the API (ADR-006 points 1 and 4) |

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
- ADR-006 point 4 settles "may provide the complete stack": the default Compose profile holds only PostgreSQL, and a `full` profile adds the one-shot `migrate` service and the API (`Planned (B7)`). No frontend container is decided (§5).

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
| Health dependencies | PostgreSQL healthcheck `Implemented` (`pg_isready`, 5 s interval, 5 retries); `depends_on` with `condition: service_healthy` on PostgreSQL, so that it accepts connections before `migrate deploy` runs (ADR-006, Deferred detail), and API `depends_on: migrate` with `condition: service_completed_successfully` (ADR-006 point 4); both `Planned (B7)` |
| Environment variables | `Implemented`: `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` and `DATABASE_PORT`, each with a default |
| Persistent PostgreSQL volume | `Implemented`: named volume `trading-analytics-postgres-data`, mounted at `/var/lib/postgresql` |
| Isolated database state | Per environment, `Implemented` by convention: `trading_analytics_dev` for development, and a separate `trading_analytics_test` on the same instance created by hand (`.env.test.example`) |
| Development workflow | `Implemented`: the default profile is PostgreSQL only |
| `full` profile | `Planned (B7)` (ADR-006 point 4): PostgreSQL, a one-shot `migrate` service and the API |
| Container time zone | `Planned (B7)`: the API and PostgreSQL containers run with `TZ=UTC` (ADR-006 point 4; §60) |

Conceptual structure:

```yaml
services:
  postgres: # default profile, Implemented
  migrate: # profile "full", one-shot (prisma migrate deploy), Planned (B7)
  api: # profile "full", depends_on migrate (service_completed_successfully), Planned (B7)
```

Exact configuration belongs to implementation.

Code vs ADR:

- The conceptual structure drops `frontend`, renames `backend` to `api` and adds the one-shot `migrate` service, following ADR-006 point 4 (amended 2026-10-07; migrations, §15).
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
| `CORS_ORIGIN` | Comma-separated allowed browser origins; default `http://localhost:5173` | `Implemented`; validation (only `http(s)://host[:port]`, `*` rejected) `Planned (B0)` (ADR-006 point 13; §33) |
| `JWT_SECRET` | Token signing secret; at least 32 characters, no default | `Implemented` |
| `JWT_EXPIRES_IN_SECONDS` | Access token lifetime in seconds; default `900` | `Implemented`; replaces `JWT_EXPIRES_IN` (ADR-006 point 8) |
| `LOG_LEVEL` | `debug` in development, `info` in production, `silent` in tests | `Planned (B3)` (ADR-009 point 7) |
| `SLOW_REQUEST_THRESHOLD_MS` | Slow-request `warn` threshold for HTTP requests; default `500` | `Planned (B3)` (ADR-009 point 8) |
| `APP_MODE` | `real` or `demo`; exposed to the web build as `VITE_APP_MODE` | `Planned (FE)` (ADR-006 point 8); replaces `DEMO_MODE` |
| `VITE_API_BASE_URL`, `VITE_WS_URL` | API and WebSocket base URLs of the real-mode web build; proposed names, build-time values (§14) | `Planned (FE)` (ADR-006 point 8) |
| `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_PORT` | Read by `docker-compose.yml` only | `Implemented` |

`LOG_FORMAT`, `ENABLE_DEBUG_LOGGING` and `ENABLE_DEV_DIAGNOSTICS` are not adopted (ADR-009 point 2). `WEBSOCKET_PATH` is not adopted either: the WebSocket is served on the API's port (7001) on a fixed path, proposed `/ws` and confirmed in B5 (ADR-007 point 1; §31).

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
| Production-like (local `full` profile) | `NODE_ENV=development`, `DATABASE_URL`, `JWT_SECRET`, plus `PORT` and `CORS_ORIGIN` if they differ from the defaults | `Planned (B7)` |

Code vs ADR:

- No repository document lists these variables outside this table; `README.md` and `CONTRIBUTING.md` are aligned in T5.2.
- `.env.example` opens with a stale Spanish note ("variables reales se agregan a medida que se implementen") although the API variables already exist, and it lacks `LOG_LEVEL` and `SLOW_REQUEST_THRESHOLD_MS` (B3) and `APP_MODE` (FE). Fixing the file is a code change and belongs to the block that adds each variable.
- `.env.test.example` sets `NODE_ENV=test`, which disables rate limiting in the integration suite (`apps/api/src/middleware/rate-limit.ts`). Rate limits in development stay on, and restarting the API clears the counters (ADR-006, Deferred detail; B0). `LOG_LEVEL=silent` in tests is `Planned (B3)` (ADR-009 point 7).

---

# 12. Configuration Validation

**Status:** `Implemented` for the five variables `env.ts` validates; `DATABASE_URL` `Planned (B7)` (`09-security-spec.md` §43); the per-entry check of `CORS_ORIGIN` `Planned (B0)` (ADR-006 point 13); `LOG_LEVEL`, `SLOW_REQUEST_THRESHOLD_MS` and `APP_MODE` join with their blocks

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
- Decided (ADR-006 point 13, amended 2026-10-07; `Planned (B0)`): each `CORS_ORIGIN` entry must be a `http(s)://host[:port]` origin and `*` is rejected (§33). `NODE_ENV=production` also makes the seed and the hard database reset refuse to run (§20, §21); that guard is in the database scripts, not in the schema.

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

**Status:** `Planned (FE)`

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
| Public environment identifier | `Planned (FE)`: `VITE_APP_MODE`, from `APP_MODE`, a build-time value (ADR-006 point 8) |
| Demo configuration | `Planned (FE)`: configurable base path, SPA fallback and namespaced browser storage (ADR-006 point 7); the demo calls no backend |
| API base URL and WebSocket URL | `Planned (FE)`: build-time values, proposed names `VITE_API_BASE_URL` and `VITE_WS_URL`, used by the real-mode web app, which runs on the Vite dev server against the local API (ADR-006 point 8; §27). The final names are set with the frontend code |

Code vs ADR:

- There is no web code, so nothing is exposed today. In the demo build no backend URL is needed (ADR-006 point 7), and the demo bundle contains no HTTP adapter because `VITE_APP_MODE` and the base URLs are build-time values (ADR-006 point 8, amended 2026-10-07; §23).
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
| Apply migrations | Manual (`db:migrate`, `db:test:migrate`); in the `full` profile, a one-shot `migrate` service runs `prisma migrate deploy` before the API container starts | `Planned (B7)` (ADR-006 points 4 and 5) |
| Initialize application services | `createApp()` wires middleware, routes and services | `Implemented` |
| Initialize HTTP server | `app.listen(env.PORT)`, then `[api] listening on port <n>` | `Implemented` |
| Resume background jobs | `PROCESSING` jobs fail as `INTERRUPTED`, and `QUEUED` jobs resume | `Planned (B4)` (ADR-008 point 5) |
| Initialize WebSocket layer | Not present | `Planned (B5)` (ADR-007) |
| Expose readiness | `GET /health/ready` answers as soon as the server listens | `Implemented` |

Code vs ADR:

- The sequence is a target, and the table lists where the code departs from it. The API is ready to serve as soon as `listen` returns, with no gate on the database.
- Decided (ADR-006 point 4, amended 2026-10-07; `Planned (B7)`): `prisma migrate deploy` runs as a one-shot `migrate` service in the `full` profile, not in the API process or its entrypoint. The API service has `depends_on: migrate` with `condition: service_completed_successfully`, and the API container starts with `node dist/index.js` directly (§26). In the `full` profile, "startup applies migrations" (ADR-006 point 5) means this service. Its position relative to the PostgreSQL healthcheck is in §6 (ADR-006, Deferred detail).
- Open (B3): the log level of the startup entry (no ADR sets it).

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
- drains in-flight requests, with a timeout of 10 seconds; if the drain expires, the remaining connections are closed and the process exits with code 1, otherwise with code 0;
- closes Prisma;
- logs `app.shutdown.started` and `app.shutdown.completed` (ADR-009 point 11).

| Step of the diagram | Status |
|---|---|
| Shutdown signal: `SIGTERM` and `SIGINT` | `Planned (B3)` |
| Stop accepting new work: server stops accepting connections; readiness 503 | `Planned (B3)` |
| Stop new background jobs | `Planned (B4)`: joins the sequence when the job runner exists (ADR-006, Deferred detail) |
| Handle realtime connections | `Planned (B5)`: joins the sequence when the realtime server exists (ADR-006, Deferred detail); connections close with code `1001`, server going away (ADR-007 point 15) |
| Finish or cancel active operations: drain in-flight requests, 10 s timeout | `Planned (B3)` |
| Close database pool: Prisma closed | `Planned (B3)` |
| Flush critical diagnostics | No separate step is decided: ADR-009 point 3 writes one JSON line per event to stdout, with no log files and no buffered transport in production |
| Exit | `Planned (B3)` |

Code vs ADR:

- `apps/api/src/index.ts` discards the value `app.listen` returns and registers no signal handler, so a signal ends the process at once and drops in-flight requests. Prisma is never disconnected. The original text said "appropriate signals"; ADR-006 point 12 names `SIGTERM` and `SIGINT`.
- Decided (ADR-006 point 12, exit code; `Planned (B3)`): if the 10-second drain expires, the remaining connections are closed and the process exits with code 1; otherwise it exits with code 0.
- Decided (ADR-006 point 12, readiness body; `Planned (B3)`): while the API is shutting down, the 503 body of `GET /health/ready` is `status: "unavailable"` with no `checks` (§50).
- Open (B3): the log levels of the two shutdown entries (no ADR sets them).
- Decided (ADR-008 point 5): a `PROCESSING` import interrupted by shutdown is marked `FAILED` with reason `INTERRUPTED` on the next startup and stays retryable; §54 repeats it.
- Open (B5): where the realtime close sits in the sequence (the close code is `1001`, ADR-007 point 15).

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
| Migrations | `Implemented` (§18); applied in the full stack by the one-shot `migrate` service `Planned (B7)` (ADR-006 points 4 and 5) |
| Seeds | `Implemented` (§20); never automatic (ADR-006 point 5) |
| Connection configuration | `Implemented`: `DATABASE_URL`, with `?schema=public`; startup validation `Planned (B7)` (§12); a runtime role separate from the migration role `Planned (B0)` (ADR-005 point 13) |
| Pool configuration | Prisma's defaults apply; in the `full` profile `connection_limit` stays at Prisma's default until measured, `Planned (B7)` (ADR-006, Deferred detail) |
| Reset process | `Implemented` (§21) |
| Production backup expectations | `Reference`: not applicable to a local environment; documented as such, not claimed (ADR-006 point 9) |

Code vs ADR:

- The API connects with the container's superuser (`POSTGRES_USER`) today. The migration role keeping DDL rights and a data-only runtime role are decided in ADR-005 point 13 (`Planned (B0)`).
- There is no backup because there is no hosted database (ADR-006 points 2 and 9). The local database can be rebuilt from migrations and the seed.

---

# 18. Database Migrations

**Status:** `Implemented` with Prisma Migrate; CI `Planned (B0)`; application in the full stack by the `migrate` service `Planned (B7)`

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
| `Deployment` step of the diagram | `Planned (B7)`: `prisma migrate deploy` runs in the one-shot `migrate` service of the `full` profile, before the API container starts (ADR-006 points 4 and 5); there is no hosted deployment |

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
- Sequencing: the full stack applies migrations in the one-shot `migrate` service, which the API service waits for with `depends_on` and `service_completed_successfully` (ADR-006 points 4 and 5), and PostgreSQL health is awaited first (`Planned (B7)`, ADR-006 Deferred detail).

---

# 20. Seed Data

**Status:** `Implemented` for the development seed; the production guard `Planned (B0)`; the Demo Mode data layers `Deferred`

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

- The seed always runs `wipeDatabase()` first, so it deletes existing rows before it inserts (`packages/database/src/seed/index.ts`, `wipe.ts`). That is acceptable for a local development database. No guard checks `NODE_ENV` or the database name, so running it against another `DATABASE_URL` deletes that data. Decided (ADR-006 point 13; `Planned (B0)`): the seed refuses to run when `NODE_ENV=production`. A check on the database name is not decided.
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
| Production guard | None today. The seed and the hard reset refuse to run when `NODE_ENV=production` (ADR-006 point 13) | `Planned (B0)` |
| Demo reset | Resetting the demo's browser-side state | `Deferred` (ADR-010 point 6; `05-data-model.md` §34-37) |

Code vs ADR:

- The diagram describes the hard reset. The light reset skips "Recreate schema" and "Run migrations".
- Both commands act on the database named by `DATABASE_URL` in `.env` (`packages/database/package.json`). Nothing checks `NODE_ENV` or the database name. The only guard is Prisma's confirmation on the hard reset; the seed has none. The `NODE_ENV=production` refusal for both is `Planned (B0)` (ADR-006 point 13; §20). A check on the database name is not decided.
- "Clearly separated from production operations" holds by construction: there is no production database (ADR-006 point 2), and the reset commands read `.env` while the tests read `.env.test.local`, so a reset never touches the test database unless both files point at the same one. A backup to restore from does not exist either (ADR-006 point 9).
- The full stack never seeds on startup (ADR-006 point 5), so a demonstration that needs data runs the seed as an explicit command (`Planned (B7)` for the stack itself).

---

# 22. Demo Deployment

**Status:** `Planned (FE)`; demo hosting and simulated latency and failures `Deferred`

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
| Demo hosting: how the build reaches the portfolio site | `Deferred` to the frontend-stage ADR (ADR-010 point 6; ADR-006 point 7) |
| Demo composition root with in-memory implementations of the repository contracts, calling `@trading/application` and the presenters of `@trading/contracts` | `Planned (FE)` (ADR-001 point 4; ADR-002 point 5) |
| Local persistence: namespaced browser storage | `Planned (FE)` (ADR-006 point 7); what is stored and how it resets is `Deferred` (ADR-010 point 6) |
| Simulated latency and scripted failures | `Deferred` (ADR-010 point 6) |
| Simulated realtime: in-process adapter fed by `@trading/market-sim` | Engine `Planned (B5)` (ADR-007 point 7); adapter `Planned (FE)` |

Code vs ADR:

- The "mock API" box is the in-process adapter behind the `TradingClient` port, not an HTTP mock. Mocking at the HTTP client level was rejected (ADR-001, Alternatives Considered), so the demo runs the real use cases and presenters.
- No web code exists: `apps/web` holds the wireframe files only and is not a workspace package (`06-architecture.md` §4).
- Deferred (ADR-010 point 6, amended 2026-10-07; ADR-006 point 7): how the demo build reaches the portfolio site is decided in the frontend-stage ADR, with the base path, the SPA fallback and the numeric bound of the demo simulation (§24, §28). ADR-006 point 10 rules out continuous deployment. It does not block B0-B7.
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
- Decided (ADR-006 point 8, amended 2026-10-07; `Planned (FE)`): `VITE_APP_MODE`, and the API and WebSocket base URLs (proposed names `VITE_API_BASE_URL` and `VITE_WS_URL`), are build-time values: one bundle per mode. The demo bundle therefore contains no HTTP adapter. The real-mode web app runs on the Vite dev server against the local API (§14, §27).

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
| Bounded simulation resources | The numeric bound for the in-browser simulation is decided in the frontend-stage ADR (ADR-010 point 6) | `Deferred` |

Code vs ADR:

- The security view is `09-security-spec.md` §41 and `12-demo-mode-spec.md` §58-59. In the demo, the use-case checks give parity with the real API, not security, because no server enforces them (NFR-026; `09-security-spec.md` §47).
- The headers of the static host are outside this project's control (NFR-025 accepted exception; `09-security-spec.md` §25).
- Deferred (ADR-010 point 6, amended 2026-10-07): the numeric bound of the demo simulation, for example a cap on retained ticks and events, is decided in the frontend-stage ADR with the demo specifics. ADR-007 point 8 bounds retention in real mode only. It does not block B0-B7.

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
| Predictable startup: PostgreSQL healthy before `migrate deploy`, and `migrate` completed before the API | `Planned (B7)`: `depends_on` with `condition: service_healthy` on PostgreSQL (ADR-006, Deferred detail); the API has `depends_on: migrate` with `condition: service_completed_successfully` (ADR-006 point 4) |
| Health checks: PostgreSQL | `Implemented`: `pg_isready` in `docker-compose.yml` |
| Health checks: API container | `GET /health` and `GET /health/ready` exist; the container healthcheck probes `GET /health/ready` `Planned (B7)` (ADR-006 point 4; §51) |
| Graceful shutdown | `Planned (B3)` (§16; ADR-006 point 12); in the container it needs the direct `node dist/index.js` entrypoint below |
| Reproducibility and minimal runtime dependencies | `Planned (B7)`; the Node version comes from `.nvmrc`, reused by the Dockerfile (ADR-006 point 13; §37); base-image pinning and the dependency split are open |
| Time zone | `Planned (B7)`: the API and PostgreSQL containers run with `TZ=UTC` (ADR-006 point 4; §60) |
| `full` Compose profile (PostgreSQL, the one-shot `migrate` service and the API) | `Planned (B7)` (ADR-006 point 4) |

Code vs ADR:

- `docker-compose.yml` defines one service, `postgres` (`postgres:18`), with no profiles. `docker/` holds a `.gitkeep` only, and no Dockerfile exists.
- Decided (ADR-006 point 4, amended 2026-10-07; `Planned (B7)`): the Dockerfile is `apps/api/Dockerfile`, built with the workspace root as the build context, since the image needs the workspace packages.
- Decided (ADR-006 point 4, amended 2026-10-07; `Planned (B7)`): the API container starts with `node dist/index.js` directly, with no shell or package-manager wrapper, so `SIGTERM` reaches the process and the shutdown of ADR-006 point 12 runs. Migrations are not part of the entrypoint: the one-shot `migrate` service applies them (§15).
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
| Real-mode web app against the local API | `Planned (FE)`: runs on the Vite dev server against the local API, with the API and WebSocket base URLs as build-time values (ADR-006 point 8; §14) |

Code vs ADR:

- `apps/web` is not a workspace package, so `pnpm build` (`pnpm -r build`) does not cover it today.
- The demo needs no Node.js runtime: its host serves static files (ADR-006 point 7). The `full` profile has no web service (ADR-006 point 4), so the real-mode web app is not served by the stack. Decided (ADR-006 point 8, amended 2026-10-07; `Planned (FE)`): it runs on the Vite dev server against the local API.

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
| SPA fallback | `Planned (FE)` (ADR-006 point 7); the mechanism is `Deferred` to the frontend-stage ADR (ADR-010 point 6) |
| Configurable API origin | Not needed by the public demo, which calls no backend (ADR-006 point 7); for the real mode a build-time value, `VITE_API_BASE_URL` (proposed name), `Planned (FE)` (ADR-006 point 8; §14) |
| Git-based deployment | `Deferred`: ADR-006 point 10 excludes continuous deployment, and the way the build reaches the host is decided in the frontend-stage ADR (ADR-010 point 6; §22) |

Code vs ADR:

- ADR-006 decides the hosting model, a subpath of the author's portfolio site (context and point 7), and names no provider. This section therefore names none.
- Deferred (ADR-010 point 6, amended 2026-10-07): demo hosting, the base path value and the SPA fallback mechanism are decided in the frontend-stage ADR. Whether the portfolio host serves HTTPS and a SPA fallback for the subpath stays open until then. The requirements of ADR-006 point 7 (configurable base path, SPA fallback) stay. It does not block B0-B7.

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
- Pool configuration: in the `full` profile `connection_limit` stays at Prisma's default until measured, `Planned (B7)` (ADR-006, Deferred detail; §17). The PostgreSQL container runs with `TZ=UTC` (ADR-006 point 4; §60).

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
| Persistent connections and upgrades | `Planned (B5)`: the `ws` library behind a transport port, on the same server and port as the API (ADR-007 point 1) |
| Endpoint path | `Planned (B5)`: fixed, proposed `/ws`, confirmed in B5; no `WEBSOCKET_PATH` variable (ADR-007 point 1) |
| Timeout behavior | `Planned (B5)`: heartbeat with a ping every 30 seconds, and a socket closed after 2 consecutive missed pongs (`08-realtime-spec.md` §7) |
| Reconnects | `Planned (FE)` (`08-realtime-spec.md` §27) |
| Proxy configuration | `Deferred`: the local stack has no proxy (§32) |
| Provider support | `Deferred` (ADR-006 point 2) |

Code vs ADR:

- No WebSocket code exists. The "provider" and "production-like deployment" wording applies to a hosted backend, which ADR-006 point 2 defers. The production-like target is the local full stack, which stays the only target.
- Decided (ADR-007 point 1, amended 2026-10-07; `Planned (B5)`): the WebSocket is served by the same HTTP server and port as the API (7001), on a fixed path, proposed `/ws` and confirmed in B5. The full stack therefore publishes one port. There is no `WEBSOCKET_PATH` variable (§10).

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

**Status:** `Implemented` (`apps/api/src/app.ts`, `apps/api/src/config/env.ts`); origin validation `Planned (B0)`; credentials `Planned (B2)`; `X-Request-ID` exposure `Planned (B3)`

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
| Origin validation: only `http(s)://host[:port]` entries, `*` rejected | `Planned (B0)` (ADR-006 point 13) |
| Credentials for the refresh cookie | `Planned (B2)` (ADR-005 Consequences) |
| `X-Request-ID` readable by the browser | `Planned (B3)`: `exposedHeaders` (ADR-009 point 5) |
| Public demo | No entry needed: it calls no backend (ADR-006 point 7) |

Code vs ADR:

- `request-id.ts` sets `X-Request-ID` on every response, but the CORS configuration has no `exposedHeaders` and no `credentials`, so a browser on another origin cannot read the header today and sends no cookies.
- The default origin also applies when `NODE_ENV=production` and `CORS_ORIGIN` is unset. `env.ts` does not check that each entry is a well-formed origin and does not reject `*`.
- Decided (ADR-006 point 13, amended 2026-10-07; `Planned (B0)`): `env.ts` validates each `CORS_ORIGIN` entry. Only `http(s)://host[:port]` origins are accepted, and `*` is rejected.
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
| Explicit Node.js version | `engines.node` is `>=22.0.0` in the root `package.json`; there is no `.nvmrc` or `.node-version`. A single `.nvmrc` becomes the source of truth, reused by CI and the Dockerfile, with `engines.node` and `@types/node` aligned to it (ADR-006 point 13) | `Implemented` as a range; the `.nvmrc` pin `Planned (B0)`, exact major chosen in B0 |
| Consistent package manager | `packageManager` is `pnpm@12.3.4`; `engines.pnpm` is `>=9.0.0` (`04-tech-stack.md` §37) | `Implemented` |
| Deterministic commands | Root scripts `build`, `test`, `typecheck`, `lint`, `format:check` and `docs:check` | `Implemented` |
| Install from the lockfile on a clean checkout | The GitHub Actions workflow (ADR-006 points 10 and 11) | `Planned (B0)` |
| Shared TypeScript configuration | `tsconfig.base.json`, extended by `apps/api`, `packages/domain` and `packages/database`; the root `tsconfig.json` references the three | `Implemented` |
| Pinned container base images | The `full` profile does not exist yet; `docker-compose.yml` pins `postgres:18` to the major version. The Node.js base image follows `.nvmrc` (ADR-006 point 13) | `Planned (B7)`; how images are pinned is open |

Code vs ADR:

- The sentence about an LTS release was written before implementation. The code targets Node.js 22 or later. Decided (ADR-006 point 13, amended 2026-10-07; `Planned (B0)`): one `.nvmrc` is the single source for the Node.js version and CI and the Dockerfile reuse it (§43, §59). The exact major is chosen in B0, when CI is created, after confirming that it is an LTS release.
- Versions differ across packages: `typescript` is `^5.7.3` in `packages/domain` and `packages/database` but `^6.0.3` at the root and in `apps/api`, and `@types/node` is `^22.20.2` in `apps/api` but `^26.4.1` elsewhere. The `@types/node` versions are aligned to `.nvmrc` (ADR-006 point 13, B0); the `typescript` difference stays the open detail of `04-tech-stack.md` (B0).
- `engines.pnpm >=9.0.0` admits versions older than the `pnpm@12.3.4` that produced the lockfile. No ADR decides it. Open (B0): align it with `packageManager`.

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
| `docker/` | `.gitkeep` only | `Deferred`: the Dockerfile is `apps/api/Dockerfile` (ADR-006 point 4; §26), so no ADR gives `docker/` content |
| `package.json` | Root manifest and scripts | `Implemented` |
| Not in the diagram | `packages/domain` and `packages/database` `Implemented`; `packages/application` `Planned (B0)` (ADR-001); `@trading/market-sim` `Planned (B5)` at `packages/market-sim` (ADR-007 point 7) | per package |

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

**Status:** backend stages `Planned (B0)` (ADR-006 points 10-11); component, E2E and accessibility stages `Deferred`; nothing runs on a server today

CI should validate meaningful changes.

The original recommended pipeline, kept as the target shape. The decided stages are in the table below:

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

Decided (ADR-006 points 10-11): one GitHub Actions workflow on pushes and pull requests to `develop` and `main`, with no continuous deployment. It is the workflow of `10-testing-strategy.md` §53.

| Stage | Command | Status |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | `Planned (B0)` |
| Type check | `pnpm typecheck` (`tsc --build`) | `Planned (B0)` |
| Lint | `pnpm lint` | `Planned (B0)` |
| Formatting | `pnpm format:check` | `Planned (B0)` (ADR-006 point 11) |
| Documentation check | `pnpm docs:check` | `Planned (B0)` (ADR-006 point 11, amended 2026-10-07): closes the CI part of task T1.5 |
| Unit and integration tests | `pnpm test` (`pnpm -r test`: the domain, database and API suites; the latter two against a PostgreSQL service container, migrated first, §42) | `Planned (B0)` |
| Build | `pnpm build` (`pnpm -r build`): proves the packages compile from a clean checkout; running the built API is B7 (ADR-006 point 11) | `Planned (B0)` |
| Component, E2E and accessibility | Tools chosen in the frontend-stage ADR; they join the workflow once frontend code exists (ADR-006 point 11) | `Deferred` |
| Artifact validation | No stage is decided (§44) | `Deferred` |
| Coverage | No stage and no threshold in version 1 (ADR-006 point 11) | `Deferred` |

Code vs ADR:

- No workflow exists. `.github/` holds only `PULL_REQUEST_TEMPLATE.md`. Every stage above exists as a local script in the root `package.json`, and the Husky pre-commit hook runs `lint-staged` only (formatting and lint of staged files).
- ADR-006 point 10 names install, typecheck, lint and the three suites; point 11 adds `format:check` and `build`. Decided (ADR-006 point 11, additions of 2026-10-07; `Planned (B0)`): the workflow also runs `pnpm docs:check`, because `docs/` is in `.prettierignore` and `format:check` never covers the SDD. This closes the CI part of task T1.5.
- The ADR fixes install first and nothing else about order. The original "Integration Tests" and "E2E Tests" stages do not exist as separate stages: `pnpm test` runs every backend suite, and E2E is `Deferred`. Recommendation for B0: cheap checks first (lint, type check, formatting), then build, then tests, in one job.
- `packages/contracts` holds a `.gitkeep` and `packages/config` is empty, so `pnpm test` covers three packages today. New packages join it with their own `test` script.
- The pull request template checklist asks for `pnpm typecheck` and `pnpm lint` only; aligning it with the workflow is T5.2.

---

# 42. CI Database

**Status:** `Planned (B0)` (ADR-006 point 10)

Integration tests must use an isolated disposable PostgreSQL instance.

Decided: a PostgreSQL service container of the workflow (ADR-006 point 10). The other approaches of the original list, a Docker service started by hand and a test container library, are not adopted.

| Item | Status |
|---|---|
| Disposable instance: the service container lives for one workflow run | `Planned (B0)` |
| Migrated before the suites: `prisma migrate deploy` through `db:test:migrate` of `@trading/database` (`10-testing-strategy.md` §53) | `Planned (B0)` |
| Test data: each suite creates and deletes its own rows (`apps/api/src/test-utils/fixtures.ts`); no seed runs | `Implemented` |
| Local equivalent: a separate `trading_analytics_test` database on the development instance, created by hand (`.env.test.example`) | `Implemented` |
| Runtime and migration roles: the test database uses the two roles of ADR-005 point 13 (ADR-006 point 11, additions of 2026-10-07) | `Planned (B0)` |
| PostgreSQL image version in CI | Open (B0): see Code vs ADR |

CI must never use a production database.

Code vs ADR:

- No production database exists (ADR-006 point 2). The rule is met by construction: the only database the workflow can reach is its own service container, with throwaway credentials, and no workflow secret holds another connection string.
- The development Compose file pins `postgres:18`. Recommendation: the service container uses the same major version, so tests run against the engine the stack uses.
- The API connects as the container's superuser today. ADR-005 point 13 (`Planned (B0)`) separates a data-only runtime role from the migration role. Decided (ADR-006 point 11, additions of 2026-10-07; `Planned (B0)`): the CI test database uses those two roles, so the suites connect with the runtime role and `migrate deploy` runs with the migration role, as in the local stack, and CI exercises the role split. How the workflow creates the two roles is an implementation detail of B0.

---

# 43. CI Environment

**Status:** per item (table below); `Planned (B0)` for the workflow

CI should define the items below. Variable names follow `apps/api/src/config/env.ts` (§10).

| Item | Today or decided | Status |
|---|---|---|
| Node.js version | `engines.node` is `>=22.0.0` and there is no `.nvmrc` today. Decided (ADR-006 point 13): a single `.nvmrc` is the source, reused by the workflow and the Dockerfile; the exact major is chosen in B0 after confirming it is an LTS release (§37, §59) | Pin `Planned (B0)` |
| Package manager | `packageManager` is `pnpm@12.3.4` in the root `package.json` | `Implemented`; use in the workflow `Planned (B0)` |
| Test mode | `NODE_ENV=test` (`.env.test.example`); it disables rate limiting in the integration suite (`apps/api/src/middleware/rate-limit.ts`) | `Implemented` locally; in CI `Planned (B0)` |
| Database configuration | `DATABASE_URL` pointing at the service container (§42) | `Planned (B0)` |
| Deterministic seed data | Suites build their own fixtures; the seed never runs automatically (ADR-006 point 5) and the workflow has no seed step | `Implemented` (fixtures) |
| Required non-secret variables | `DATABASE_URL`, `NODE_ENV=test`, and a throwaway `JWT_SECRET` of at least 32 characters (§11) | `Planned (B0)`; supplied through the job `env` (ADR-006 point 11) |
| Secrets | None needed: there is no deployment and no hosted service (ADR-006 points 2 and 10). A repository secret store is not used | `Reference` |

Secrets should use the CI platform's secret store if necessary.

Code vs ADR:

- The `test` scripts of `apps/api` and `packages/database`, and `db:test:migrate`, load `../../.env.test.local` through `dotenv-cli`. The file is git-ignored, so it does not exist on a clean checkout. `dotenv-cli` overrides variables already set only with its `-o` option, so the workflow can set the variables in the job `env` instead. Decided (ADR-006 point 11, additions of 2026-10-07; `Planned (B0)`): CI supplies the test variables through the job `env` and does not generate `.env.test.local`, so the workflow holds no file that could be mistaken for a secret.
- The workflow's Node.js version comes from the `.nvmrc` of ADR-006 point 13 (§37, §59); the exact major is chosen in B0.

---

# 44. Build Artifacts

**Status:** per item (table below)

CI may produce the items below. Version 1 has no continuous deployment (ADR-006 point 10), so nothing is published or uploaded.

| Artifact | Today or decided | Status |
|---|---|---|
| Backend build | `tsc --build` writes `dist` in each package. The API does not run from `dist` yet (ADR-006 point 3) | Compile `Implemented`; in CI `Planned (B0)`; runnable `Planned (B7)` |
| Frontend build | `apps/web` holds the wireframe only, with no `package.json` | `Planned (FE)` |
| Docker image | Built on the author's machine by the `full` profile; CI builds and pushes no image (no registry, no deployment) | Local `Planned (B7)`; image build in CI `Deferred` |
| Test reports | None kept: the suites print to the console and nothing is uploaded | `Deferred` |
| Coverage reports | None: no coverage gate in version 1 (ADR-006 point 11) | `Deferred` |

Generated artifacts should not be committed to Git. `.gitignore` covers `dist/`, `build/`, `*.tsbuildinfo` and `coverage/`, and no tracked file matches them.

Code vs ADR: the original list assumed a pipeline that produces and keeps artifacts. ADR-006 point 11 limits CI to proving that the packages compile (`pnpm build`), so the Docker image, test report and coverage report entries are possibilities for a later ADR, not requirements.

---

# 45. Deployment Pipeline

**Status:** hosted deployment `Deferred` (ADR-006 points 2 and 10); local stack steps `Planned (B7)`; demo publishing `Planned (FE)`

A simple deployment flow, as originally written for a hosted backend:

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

What the two targets of ADR-006 point 1 have for each step:

| Step | What exists or is decided | Status |
|---|---|---|
| Git push | CI runs on pushes and pull requests to `develop` and `main` (§41) | `Planned (B0)` |
| CI validation | §41 | `Planned (B0)` |
| Build | `pnpm build` compiles the packages; the web build of the demo is separate (§27) | Compile `Implemented`; in CI `Planned (B0)` |
| Package or artifact | The API image of the `full` profile (multi-stage, non-root), built on the author's machine; for the demo, a static build of `apps/web` | `Planned (B7)`; demo `Planned (FE)` |
| Deploy | Local: `docker compose --profile full up`. Demo: published under a subpath of the portfolio site; the hosting and publishing mechanism are decided in the frontend-stage ADR (ADR-010 point 6). Backend: no host | Local `Planned (B7)`; demo mechanism `Deferred` (frontend-stage ADR); backend `Deferred` |
| Database migration | `prisma migrate deploy` at the start of the run that starts the API (ADR-006 point 5, §15, §19) | `Planned (B7)` |
| Health check | `GET /health` and `GET /health/ready` (§50) | `Implemented`; container healthcheck `Planned (B7)` (§51) |
| Smoke test | §49 | `Planned (B7)` |

Code vs ADR:

- There is no deployment pipeline: ADR-006 point 10 decides no continuous deployment. The flow above is a sequence a person runs on the local stack, not an automated chain from a push.
- The original order puts the migration after the deploy. ADR-006 points 4 and 5 apply it in the one-shot `migrate` service of the same `docker compose up` run (§19), before the API starts, so the migration comes first.
- `Deferred` (frontend-stage ADR, ADR-010 point 6): how the demo build reaches the portfolio site (a manual copy or a workflow of that site's repository) is part of the demo hosting decision. Recommendation for that ADR: leave it manual in version 1, which is consistent with no continuous deployment.

---

# 46. Deployment Ordering

**Status:** `Reference`; each item's mechanism `Planned (B7)` or `Planned (FE)` (table below)

Deployment must consider compatibility between:

- application version
- database schema
- API contract
- frontend version

Where practical, migrations should support compatibility during rollout.

Complex zero-downtime orchestration is not required for the initial project.

| Compatibility | How it holds in version 1 | Status |
|---|---|---|
| Application and database schema | One API instance. The migration runs at the start of the run that starts the API (ADR-006 point 5), so the new code never meets an older schema. PostgreSQL health is awaited first (ADR-006, Deferred detail) | `Planned (B7)` |
| API contract | The shared schemas of `@trading/contracts` and the contract tests (ADR-002 points 3 and 6) | `Planned (B0)` |
| Frontend version | The demo is a static build with the application running in process and no backend (ADR-006 point 7), so a deployed frontend never meets a different API version | `Planned (FE)` |
| Migration compatibility during rollout | No old version runs against the new schema with a single instance that stops before the next one starts. Compatible, stepwise migrations remain good practice (§19) but no ADR requires them | `Reference` |

Code vs ADR: the original text assumes several deployed components that can run side by side in different versions. ADR-006 point 2 removes hosting, so the only version skew left is between a developer's running API and the schema of their database; the migration applied at startup (`Planned (B7)`) closes it for the full stack, and `db:migrate` covers development.

---

# 47. Rollback

**Status:** `Reference`: forward-fix only (ADR-006 point 6)

The original text asked for rollback to be considered separately for the application, the frontend and the database. ADR-006 point 6 removes "controlled rollback": a mistake is corrected by a new change, not by returning to an older state.

### Application

No artifact is hosted, so there is none to redeploy (ADR-006 point 2). A faulty change is corrected by a new commit (a fix or a revert) and a new local run of the stack (`Planned (B7)`).

### Frontend

The demo is a static build of one commit. A faulty demo is corrected by building a corrected commit. Restoring a previously published build depends on the hosting of the portfolio site, which the frontend-stage ADR decides (ADR-010 point 6; §28), so it is `Deferred`.

### Database

Prisma Migrate has no down migrations (§18). A schema change is corrected by a new forward migration, and a development database can be reset with `db:reset` (§21).

Database rollback is not automatically equivalent to application rollback. Reverting the application code after a migration has been applied leaves the schema ahead of the code. The fix is a forward migration, not a return to the earlier state.

Code vs ADR:

- The original lines "Redeploy a known-good artifact", "Restore a previous static build" and "Rollback only when safe and supported by the migration/data model" are replaced by ADR-006 point 6.
- `Deferred` (frontend-stage ADR, ADR-010 point 6): whether the demo's publishing step keeps previous builds belongs to the demo hosting decision. Recommendation for that ADR: no, because the demo is rebuilt from Git and a revert commit is the forward fix.

---

# 48. Deployment Verification

**Status:** per step (table below); automated verification `Planned (B7)`; verification is manual today

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

Applied to the local full stack and to the demo:

| Step | Today | Status |
|---|---|---|
| Frontend loads | The demo page loads under its subpath. The smoke test of the full stack has no frontend step (ADR-006 point 11, additions of 2026-10-07; §49); whether a frontend container exists stays open (§7; B7) | Demo `Planned (FE)`; full stack: no frontend step |
| API reachable | `GET /health` answers 200 while the process serves | Route `Implemented`; automated check `Planned (B7)` |
| Database ready | `GET /health/ready` runs `SELECT 1`; PostgreSQL has its own `pg_isready` healthcheck | `Implemented` |
| Authentication works | `POST /api/v1/auth/login` and `GET /api/v1/auth/me` exist; refresh and logout do not | Login `Implemented`; refresh and logout `Planned (B2)` (ADR-005) |
| Core API flow works | For example `GET /api/v1/portfolios` with a token. The flow is not chosen (§49) | Routes `Implemented`; automated check `Planned (B7)` |
| WebSocket connects | No WebSocket server exists | `Planned (B5)` (ADR-007) |
| Health reports expected state | `status: "ok"` and `checks.database: "ok"` from `GET /health/ready` | `Implemented` |

Code vs ADR:

- The API starts listening before any database check (§15), so a started process proves nothing, as the rule above says. Readiness proves only that `SELECT 1` succeeds; it does not show that migrations were applied. A readiness 200 on an unmigrated database is possible. Recommendation: the smoke test's core API flow (a route that reads a table) is the check that the schema is in place.
- NFR-055 measures the full stack by `docker compose --profile full up` from a clean checkout passing the smoke test (B7).

---

# 49. Smoke Tests

**Status:** full stack `Planned (B7)` as one script with no frontend step (ADR-006 point 11); demo `Planned (FE)`; the content of check 5 is a B7 detail

Minimum smoke tests should verify:

1. frontend accessibility
2. API health
3. authentication
4. authenticated request
5. primary portfolio flow
6. realtime connection
7. expected error handling

How each applies:

| Check | Full stack | Demo |
|---|---|---|
| 1. Frontend accessibility | No frontend step in the full-stack smoke test (ADR-006 point 11, additions of 2026-10-07); a frontend container stays open (§7; B7) | Page loads under the subpath: `Planned (FE)`; tool `Deferred` (frontend-stage ADR) |
| 2. API health | `GET /health` and `GET /health/ready` return 200: `Planned (B7)`. The script runs `db:seed` as an explicit step before the login check; the `full` stack is local and runs with `NODE_ENV` other than `production` (ADR-006 point 5 and its 2026-10-08 smoke-test clarification) | Not applicable: no backend |
| 3. Authentication | `POST /api/v1/auth/login` returns a token: `Planned (B7)` | In-process login: `Planned (FE)` |
| 4. Authenticated request | `GET /api/v1/auth/me` or `GET /api/v1/portfolios` with the token: `Planned (B7)` | `Planned (FE)` |
| 5. Primary portfolio flow | Not chosen; a read of the seeded portfolio is the smallest candidate: `Planned (B7)`, flow chosen in B7 | `Planned (FE)` |
| 6. Realtime connection | `Planned (B5)`; added to the smoke test when the WebSocket server exists | `Planned (FE)` |
| 7. Expected error handling | One request that returns the standard error envelope, for example `401` without a token: `Planned (B7)` | `Planned (FE)` |

Code vs ADR:

- No ADR defines the smoke test. `10-testing-strategy.md` has no smoke-test section, and `BACKEND-ROADMAP.md` B7 defers the definition to this section. `apps/api/src/app.test.ts` is a wiring test, not a deployment smoke test.
- The smoke test belongs to the B7 definition of done (NFR-054 under a 512 MB container limit, NFR-055 from a clean checkout). CI does not run it (ADR-006 point 11: running the built API stays B7).
- Decided (ADR-006 point 11, additions of 2026-10-07; `Planned (B7)`, with the `full` profile): the smoke test is one script run after `docker compose --profile full up`, with no frontend step. It covers the checks marked `Planned (B7)` in the table (2, 3, 4, 5 and 7; check 6 joins in B5). The flow of check 5 is chosen in B7.

---

# 50. Health Checks

**Status:** `Implemented` (`apps/api/src/routes/health.ts`, NFR-051); 503 while shutting down `Planned (B3)` (ADR-006 point 12); route test `Planned (B0)` (ADR-001 point 8)

The deployment must preserve the health model from `13-observability-spec.md` (§22-23).

The endpoint names are final, not recommended (`07-api-spec.md` §30):

```text
GET /health
GET /health/ready
```

| Endpoint | Behavior | Status |
|---|---|---|
| `GET /health` (liveness) | Always 200 with `status`, `service` and `timestamp`; no dependency check | `Implemented` |
| `GET /health/ready` (readiness) | `SELECT 1` against the database on every call; 200 with `checks.database: "ok"`, or 503 with `status: "unavailable"` and `checks.database: "unavailable"` | `Implemented` (`apps/api/src/controllers/health.controller.ts`, `apps/api/src/services/health.service.ts`) |
| Readiness while shutting down | 503 with `status: "unavailable"` and no `checks` (ADR-006 point 12) | `Planned (B3)` |

Liveness should answer whether the process is alive.

Readiness should answer whether required dependencies are available. It is stateless: nothing is cached and no state records a past failure.

Health responses must never expose credentials or internal secrets. Both bodies hold only fixed fields and the `ok` or `unavailable` value of the database check (`13-observability-spec.md` §24).

Code vs ADR:

- Decided (ADR-006 point 12, readiness body; `Planned (B3)`): while the API is shutting down, the 503 body of `GET /health/ready` is `status: "unavailable"` with no `checks`, so the body does not claim that the database failed.
- Readiness checks the database only; the job runner (B4) and the simulator (B5) are not added to it by any ADR (`13-observability-spec.md` §23).
- No test covers either route today; the health route test is in the B0 set (ADR-001 point 8, ADR-009 point 13).

---

# 51. Container Health

**Status:** PostgreSQL healthcheck `Implemented`; API container healthcheck `Planned (B7)`, probing `GET /health/ready` (ADR-006 point 4)

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

| Item | Today | Status |
|---|---|---|
| Process running | `GET /health` (§50) | `Implemented` |
| Application ready | `GET /health/ready` (§50) | `Implemented` |
| PostgreSQL container | `pg_isready` every 5 s, 5 retries (`docker-compose.yml`) | `Implemented` |
| API container | No Dockerfile and no `api` service exist | `Planned (B7)`; the healthcheck probes `GET /health/ready` (ADR-006 point 4) |
| Use of the readiness signal | The only consumer decided is `depends_on` with `condition: service_healthy` for the API on PostgreSQL (ADR-006, Deferred detail) | `Planned (B7)` |

Code vs ADR:

- The platform is Docker Compose, not an orchestrator. Compose uses a healthcheck for `depends_on` and for display. It does not route traffic away from an unhealthy container, and `restart: unless-stopped` restarts a container only when its process exits, not when it turns unhealthy.
- Decided (ADR-006 point 4, amended 2026-10-07; `Planned (B7)`): the container healthcheck probes `GET /health/ready`, so that `service_healthy` means the application can serve and a later poller can log recovery (ADR-009, Deferred detail).
- Open (B7): the probe the runtime image provides. Recommendation: one that needs no extra package in the non-root image (image details are B7).

---

# 52. Startup Diagnostics

**Status:** per item (table below); the startup entries `Planned (B3)` (ADR-009 point 11), their level open

Startup should produce safe structured events. The original list named seven examples:

```text
service.starting
configuration.validated
database.connected
application.initialized
http.ready
websocket.ready
service.ready
```

The seven names are examples, not decisions. Version 1 decides a startup pair (`app.startup.started`, `app.startup.completed`, ADR-009 point 11, amended 2026-10-07) and the shutdown pair that mirrors it (`app.shutdown.started`, `app.shutdown.completed`, ADR-006 point 12). ADR-009 point 11 names no level for them. What exists for each moment:

| Moment | Today | Status |
|---|---|---|
| Configuration validated | On failure, `[api] invalid environment configuration:` and the messages per variable (never the values), then exit code 1 (`apps/api/src/config/env.ts`). Nothing on success | Failure `Implemented` as plain text; structured entry `Planned (B3)` |
| Database connected | No explicit connect (§15); the Prisma client connects on first use | No entry; explicit check `Planned (B7)` |
| Application initialized | `createApp()` wires middleware and routes; no entry | `Planned (B3)` |
| HTTP ready | `[api] listening on port <n>` through `console.log` | `Implemented` as plain text; `app.startup.completed` `Planned (B3)` |
| WebSocket ready | No WebSocket layer | `Planned (B5)` |
| Service ready | Same as HTTP ready: readiness answers once the server listens (§15) | `Implemented` as implicit |

Startup failures must be visible through the observability system. Today they reach the process output only: an invalid environment is printed and the process exits; a failing database does not stop startup and shows only as a readiness 503 (§50).

Code vs ADR:

- Decided (ADR-009 point 11, amended 2026-10-07; `Planned (B3)`): the startup logs `app.startup.started` and `app.startup.completed`, mirroring the shutdown pair. Per-step entries (database connected, application initialized) are not decided; they add nothing while the API has one dependency and no explicit connect.
- Open (B3): the log levels of the startup and shutdown entries; no ADR sets them.
- Open (B3): whether the invalid-environment failure becomes a structured line. It is raised before the `Logger` exists (ADR-009 point 1), so plain output followed by exit 1 may stay. Recommendation: keep it as it is, since it is safe and visible.
- The `websocket.ready` entry waits for B5.

---

# 53. Observability During Deployment

**Status:** per item (table below)

Deployment must preserve the items below (`13-observability-spec.md`):

| Item | Today | Status |
|---|---|---|
| Structured logs | JSON `console` lines for errors only (`request.failed`, `health.database.unavailable`); the `Logger` port with `pino` is not built | `Planned (B3)` (ADR-009 points 1-3) |
| Request IDs | `X-Request-ID` is assigned or reused and echoed (`apps/api/src/middleware/request-id.ts`) and appears in error bodies. Propagation to every log line and exposure through CORS are not built | Header `Implemented`; propagation and exposure `Planned (B3)` (ADR-009 point 5) |
| Error diagnostics | The error handler writes one JSON line with `requestId` and `errorName` for unexpected errors | `Implemented` as a `console` line; `http.request.failed` `Planned (B3)` (ADR-009 point 6) |
| Health checks | §50 | `Implemented` |
| Metrics where implemented | No metrics and no `/metrics` endpoint | `Deferred` (ADR-009 point 10) |
| Realtime diagnostics | Connection events | `Planned (B5)` (ADR-009 point 11) |
| Startup and shutdown entries | §52 and §16 | `Planned (B3)` |

See `13-observability-spec.md`.

A deployment that cannot be diagnosed is incomplete.

Code vs ADR:

- In version 1 the diagnostic channel is the process output: one JSON line per event on stdout, with no log files (ADR-009 point 3). On the full stack that is `docker compose logs`.
- Shipping logs to a collector or a monitoring service, and alerting, belong to a hosted backend and are `Deferred` (ADR-006 point 2, ADR-009 point 10).

---

# 54. Background Jobs

**Status:** `Planned (B4)` (ADR-008 point 4); the shutdown step `Planned (B4)` (ADR-006, Deferred detail)

Background jobs run in the API process, as ADR-008 point 4 decides: an in-process runner backed by a `jobs` table in PostgreSQL, with no separate worker process and no external queue. No job code exists yet.

Deployment must account for the following:

| Concern | Decision | Status |
|---|---|---|
| Graceful shutdown | Stopping new jobs joins the shutdown sequence when the runner exists (ADR-006, Deferred detail). A validation still running at shutdown is left for the next startup: it is marked `FAILED` with reason `INTERRUPTED` on the next startup and is retryable (ADR-008 point 5) | `Planned (B4)` |
| Duplicate execution | Every transition is a compare-and-set on status, with a persisted `stage` and `attempt`; startup resume and enqueue cannot both take a job (ADR-008, Deferred detail). `Idempotency-Key` protects repeated requests (ADR-008 point 8) | `Planned (B4)` |
| Cancellation | Allowed while `QUEUED` or during validation, never during apply (ADR-008 point 6) | `Planned (B4)` |
| Timeouts | Each job type has a timeout applying while `QUEUED` or validating; the apply stage is exempt (ADR-008 point 7) | `Planned (B4)` |
| Process restarts | On startup, `PROCESSING` jobs become `FAILED` with reason `INTERRUPTED` and `QUEUED` jobs resume (ADR-008 point 5) | `Planned (B4)` |

A future worker architecture may be:

```text
API
 ↓
Queue
 ↓
Worker
```

A separate worker is not required initially unless justified. ADR-008 point 4 decides against one in version 1, so this architecture is `Deferred`.

Code vs ADR:

- The `Job` and `IdempotencyKey` tables are specified in `05-data-model.md` §52-53 but are not in `schema.prisma`; the runner and the startup step do not exist either.
- Decided (ADR-008 point 5; `Planned (B4)`): a validation running at shutdown is left for the next startup (§16). A job left in `PROCESSING` becomes `FAILED` with reason `INTERRUPTED` on the next startup and is retryable, so no job stays stuck silently; the 10-second drain (§16) is too short for a long import.
- The local stack runs one API container (§7), so two runners resuming the same jobs do not occur; running several instances is not decided.

---

# 55. Demo Background Jobs

**Status:** `Planned (FE)` (ADR-008 point 13); scripted demo failures `Deferred` (ADR-010 point 6)

Demo jobs must not require a production queue service. Real jobs do not use one either (§54), so the demo runs the same use case in process (ADR-008 point 13).

They should use the simulation infrastructure from `12-demo-mode-spec.md` (§41-43) and still demonstrate:

| Behavior | Status |
|---|---|
| Progress | `Planned (FE)` (FR-069) |
| Completion | `Planned (FE)` |
| Failure | `Planned (FE)`: CSV import failure injection (ADR-008 point 13, FR-071); other scripted failures are `Deferred` (ADR-010 point 6) |
| Cancellation | `Planned (FE)`: same rules as the real runner (ADR-008 point 6) |
| Timeout | `Planned (FE)`: the `TIMED_OUT` state (ADR-008 point 7) |

Code vs ADR: `12-demo-mode-spec.md` §41 lists four job examples (analytics recalculation, report generation, data import, export generation) and a lifecycle with `retrying`. ADR-008 point 1 decides one job type, the CSV import, and a retry returns a job to `QUEUED`. `12` is aligned when it is reconciled (T5.1).

---

# 56. Demo Persistence

**Status:** isolation `Planned (FE)` (ADR-006 point 7); the persistence layers and reset `Deferred` (ADR-010 point 6)

Demo state should remain isolated from production data.

The demo has no backend and no database. It runs the application in process with in-memory repositories (ADR-001, ADR-006 point 7), makes no call to any backend, carries no secret and namespaces its browser storage. Because no backend is hosted (ADR-006 point 2) and the build holds no connection string, the public demo cannot reach any real data by construction:

| The public demo should not modify | Why it cannot | Status |
|---|---|---|
| Real user records | No backend and no credentials in the build | `Planned (FE)` |
| Real portfolios | Same | `Planned (FE)` |
| Real database state | `DATABASE_URL` is a server variable and is not part of the web build (§11) | `Planned (FE)` |
| Private application data | The demo ships its own seed data and nothing else | `Planned (FE)` |

Code vs ADR:

- Which browser storage the demo uses, its versioning and the reset are not decided: ADR-010 point 6 leaves them to the frontend-stage ADR (`05-data-model.md` §34-37, `06-architecture.md` §14, `12-demo-mode-spec.md` §18-21). `Deferred`.
- `12-demo-mode-spec.md` §59 requires failing closed rather than falling back to real infrastructure. With no backend call at all (ADR-006 point 7) there is no real infrastructure to fall back to.
- Nothing is built: `apps/web` holds the wireframe only.

---

# 57. Local Production-like Mode

**Status:** per item (table below); the `full` profile `Planned (B7)` (ADR-006 point 4)

A production-like local mode should validate:

| Validates | How | Status |
|---|---|---|
| Production builds | `node dist/index.js` from the compiled packages (ADR-006 point 3) | `Planned (B7)` |
| Environment variables | `NODE_ENV=development` (not `production`, so the explicit `db:seed` step of the smoke test is not refused by the production guard; ADR-006 point 11), `DATABASE_URL`, `JWT_SECRET`, plus `PORT` and `CORS_ORIGIN` when they differ from the defaults (§11) | `Planned (B7)` |
| Containers | The `full` profile: PostgreSQL and the API, multi-stage and non-root (ADR-006 point 4) | `Planned (B7)` |
| Migrations | `prisma migrate deploy`, run by the one-shot `migrate` service before the API starts (ADR-006 points 4 and 5) | `Planned (B7)` |
| Health checks | The routes exist (§50); the container healthcheck is `Planned (B7)` (§51) | Routes `Implemented` |
| Realtime | The local WebSocket server | `Planned (B5)` |
| Startup and shutdown | Graceful shutdown is `Planned (B3)` (§16); the startup order is `Planned (B7)` (§15) | `Planned (B3)` and `Planned (B7)` |
| Smoke test and limits | `docker compose --profile full up` from a clean checkout passes the smoke test under a 512 MB limit (NFR-054, NFR-055; §49) | `Planned (B7)` |

Conceptually, following ADR-006 point 4:

```text
Docker Compose, profile "full"
 ├── api          (production build, NODE_ENV=development)
 └── postgres     (the default profile's service)
```

Code vs ADR:

- The original diagram listed a frontend build and a production configuration as services. ADR-006 point 4 decides PostgreSQL and the API only. Whether a frontend container exists is open (§6; B7), with the recommendation recorded there.
- `docker-compose.yml` has no `profiles` key and no `api` service. The default profile keeps only PostgreSQL for development.
- This mode is the "local full stack" target of ADR-006 point 1, used for demonstrations; it is not a rehearsal of a hosted deployment, because none is planned.

---

# 58. Dependency Security

**Status:** per item (table below); no audit step in CI in version 1

The project should:

| Practice | Today or decided | Status |
|---|---|---|
| Commit lockfiles | `pnpm-lock.yaml` is tracked | `Implemented` |
| Review dependency updates | Pull request review. No update bot is configured (NFR-024) | `Implemented` as review |
| Remove unused packages | Manual; no automated check | `Reference` |
| Run vulnerability checks when practical | Not in CI. A manual `pnpm audit --prod --audit-level=high` is a step of the B7 security checklist (NFR-024) | `Planned (B7)` |
| Keep production dependencies minimal | Principle of NFR-070. Dependencies come from the lockfile; install scripts are limited to Prisma and `esbuild` (`pnpm-workspace.yaml`, `allowBuilds`) | `Implemented` |

No dependency should be added only for appearance.

Code vs ADR:

- The minimal CI adds no dependency audit or license step in version 1: ADR-009 point 2 (recorded 2026-10-07) covers `pino`, `pino-http` and `pino-pretty` with the lockfile as their source, NFR-070 gives the reason, and `13-observability-spec.md` §63 states it. The original "run vulnerability checks when practical" is met by the manual B7 step only.
- NFR-024 cites `14-deployment-spec.md` §78 for the security checklist; that section is reconciled in a later slice.

---

# 59. Runtime Versions

**Status:** per item (table below); the Node.js pin `Planned (B0)` (ADR-006 point 13); `engines.pnpm` and the tighter PostgreSQL pin open

Node.js and PostgreSQL versions must be explicitly documented and pinned for local development.

| Item | Today | Status |
|---|---|---|
| Node.js | `engines.node` is `>=22.0.0` (root `package.json`); there is no `.nvmrc` or `.node-version`. `@types/node` is `^22.20.2` in `apps/api` and `^26.4.1` elsewhere. The author's machine runs v24.16.0 | Range `Implemented`; the `.nvmrc` pin, with `engines.node` and `@types/node` aligned to it, `Planned (B0)` (ADR-006 point 13) |
| pnpm | `packageManager` is `pnpm@12.3.4`; `engines.pnpm` is `>=9.0.0` | `Implemented`; aligning `engines.pnpm` open (B0, §37) |
| PostgreSQL | `postgres:18` in `docker-compose.yml` (`04-tech-stack.md`); a major-version pin | `Implemented`; a tighter pin open (B7) |
| Compatibility of local, CI and the container | One Node line and one PostgreSQL major across the three | CI `Planned (B0)`; image `Planned (B7)` |

The versions should be selected from currently supported releases when implementation begins. Implementation has begun: PostgreSQL and pnpm are fixed, and the Node.js line is chosen in B0 (below).

Local, CI and production-like environments should remain compatible.

Code vs ADR:

- `engines.node >=22.0.0` admits every later major, while one package types against Node 22 and the others against 26. Decided (ADR-006 point 13; `Planned (B0)`, the same decision as §37 and §43): a single `.nvmrc` is the source of truth, reused by CI and the Dockerfile, with `engines.node` and `@types/node` aligned to it. The exact major is chosen in B0, when CI is created, after confirming it is an LTS release.
- Local, CI and the container stay compatible because the three read the same `.nvmrc`, so a version change is one edit.
- Open (B0): aligning `engines.pnpm` (`>=9.0.0`) with `packageManager` (`pnpm@12.3.4`); no ADR decides it (§37).

---

# 60. Time and Timezone

**Status:** `Reference` for the principle; per item (table below)

The deployment environment should use UTC where practical.

Recommended strategy:

| Strategy | Today or decided | Status |
|---|---|---|
| Store timestamps in UTC | Prisma `DateTime` columns are `TIMESTAMP(3)` without a time zone, and Prisma writes UTC instants (migrations in `packages/database/prisma/migrations`) | `Implemented` |
| Serialize consistently | Timestamps are ISO-8601 strings in UTC (`07-api-spec.md`); a `Date` serialized to JSON is UTC, and the health `timestamp` uses `toISOString()` | `Implemented` |
| Analytics days are UTC calendar dates | ADR-004; `16-analytics-spec.md` §2; the demo and the simulator use the same boundaries | `Planned (B1)` |
| Convert to user-local time in the UI | Timestamps show in the user's local zone; analytics days stay UTC dates (`11-ui-ux-spec.md`, ADR-010 point 9) | `Planned (FE)` |
| Do not depend on the server-local time zone | No local-time accessor appears in the non-test code of `apps/api`, `packages/domain` or `packages/database` (`getHours`, `getDate`, `getFullYear`, `toLocale*`, `getTimezoneOffset`); the seed uses `getUTC*` and `setUTC*` | `Implemented` by inspection; no test enforces it |
| One time source | One shared `Clock` port (ADR-001 point 8); the simulator clock uses it (ADR-007 point 7) | `Planned (B0)`; simulator `Planned (B5)` |
| Container time zone | Neither Compose nor a Dockerfile sets `TZ` today. Decided (ADR-006 point 4): the API and PostgreSQL containers run with `TZ=UTC` | `Planned (B7)` |

This is important for trading data and historical analytics.

Code vs ADR:

- The code reads the system clock directly through `new Date()` in services and mappers (`10-testing-strategy.md` §49 lists them); the `Clock` port replaces those calls in B0.
- The migrations also give columns `DEFAULT CURRENT_TIMESTAMP`. For a `TIMESTAMP` without a zone, a value written by that default takes the PostgreSQL session time zone, so UTC holds only where the database runs in UTC or Prisma supplies the value. Decided (ADR-006 point 4, amended 2026-10-07; `Planned (B7)`): the API and PostgreSQL containers of the `full` profile run with `TZ=UTC`. Whether any write relies on a database default remains a check for B0.
- Day boundaries in analytics are decided as UTC, while code that builds the series is not yet aligned (ADR-004 Deferred detail, B1).

---

# 61. File Handling

**Status:** `Reference` for the principle; the CSV import input `Planned (B4)`

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

| Item | Today or decided | Status |
|---|---|---|
| Files the system generates or delivers | None. No functional requirement asks for an export or a download, and no code writes a file | `Reference`: there is nothing to generate, deliver or clean up |
| Files the API serves | None. `apps/api/src/app.ts` registers no static, download or `sendFile` route | `Implemented` |
| CSV import input | The CSV content is stored in the `jobs` row when the job is created, not on disk; resume and retry read the row, never the original request. The stored input is kept while the job can still be retried and cleared for `COMPLETED` jobs and for `FAILED` with `VALIDATION_FAILED` or `PORTFOLIO_ARCHIVED` (ADR-008 point 4, amended 2026-10-07 and 2026-10-08) | `Planned (B4)` |
| Size and row limits of an import | Bounded; the values are fixed in B4 (ADR-008 point 10, `09-security-spec.md` §27) | `Planned (B4)`, values set in B4 |
| Import content in logs | The stored input is never logged (ADR-009, Deferred detail) | `Planned (B3)` |
| Persistent file storage adapter | Not needed in version 1 | `Deferred` |

Code vs ADR:

- The generate, deliver and cleanup flow is the original text. In version 1 it has nothing to apply to: an import is parsed, validated and stored in the database, and no file survives the request.
- The API container of the `full` profile writes no file of its own: ADR-009 point 3 sends logs to stdout, with no log files (`Planned (B7)`). The PostgreSQL data lives in the named volume `trading-analytics-postgres-data`, which is the durable store (`docker-compose.yml`).
- `Planned (B4)`, set in B4 (ADR-008, Deferred detail): how the CSV reaches `POST /api/v1/portfolios/:portfolioId/imports`. `07-api-spec.md` §14 fixes neither multipart nor a JSON body, and the global JSON limit is 100 kB (`JSON_BODY_LIMIT` in `app.ts`), so a larger file would be rejected with 413. The transport and a route-specific body limit are set in B4 with the input limits of ADR-008 point 10; the global limit is not raised.
- Decided (ADR-008 point 4, amended 2026-10-07; `Planned (B4)`): the stored input is kept while the job can still be retried (`TIMED_OUT`, `CANCELLED`, and `FAILED` with `INTERRUPTED`, `APPLY_ERROR` or `APPLY_REJECTED`), and cleared for `COMPLETED` jobs and for `FAILED` with `VALIDATION_FAILED` or `PORTFOLIO_ARCHIVED`, which are not retryable (ADR-008 point 6, amended 2026-10-08).

---

# 62. External APIs

**Status:** `Deferred`: no external API exists or is decided

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

| Item | Today or decided | Status |
|---|---|---|
| External market-data provider | None. There is no paid provider (`04-tech-stack.md` §47-48), so prices come from the seed and from the deterministic simulator `@trading/market-sim` (ADR-007 point 7) | `Deferred`: adding one needs a new ADR |
| Outbound HTTP from the API | None. The non-test code of `apps/api`, `packages/domain` and `packages/database` makes no outbound request | `Implemented` as absence |
| Credentials for a provider | None exist, so nothing is configured (§13) | `Reference` |
| Demo independent of any external service | The demo makes no call to any backend and runs the same simulator in the browser (ADR-006 point 7, ADR-007 point 13) | `Planned (FE)` |

Code vs ADR:

- The adapter diagram stays as the shape an external provider would take. ADR-007 point 7 makes the simulator the price source in both modes, and its output in real mode is stored as `MarketPrice` and `MarketEvent` (ADR-007 point 8), so no part of the decided design needs a provider.
- A provider would add outbound dependencies, credentials, rate limits of its own and a failure mode the readiness check does not cover (§50). None of that is decided, so none of it is specified here.

---

# 63. Rate Limiting

**Status:** per item (table below); the request limiters `Implemented` (`apps/api/src/middleware/rate-limit.ts`, `apps/api/src/app.ts`); realtime limits `Planned (B5)`

Rate limiting should be considered for:

- authentication
- expensive analytics
- public endpoints
- resource-intensive operations

Exact limits should be based on the deployed environment and validated during implementation.

Rate limiting must not break local development or CI.

| Area | Limiter | Status |
|---|---|---|
| Authentication | `loginRateLimiter` on `POST /api/v1/auth/login`: 5 attempts per 15 minutes per IP, on top of the general limiter (ADR-005 point 12) | `Implemented` |
| Every other API route (including expensive analytics) | `generalApiRateLimiter`: 300 requests per 15 minutes per IP, registered after the health routes and before the body parser | `Implemented` |
| Public endpoints | `GET /health`, `GET /health/ready` and `GET /` are unversioned operational routes. The health routes are registered before the limiter and never return 429; `GET /` falls under the general limiter | `Implemented` |
| Token refresh | General limiter only; a dedicated limiter is open (`09-security-spec.md` §26) | `Planned (B2)`, open |
| Simulation control | General limiter (`simulation:control`, ADR-007 point 10) | `Planned (B5)` |
| Realtime messages | 20 inbound messages per second per connection (ADR-007 point 15) | `Planned (B5)` |
| Resource-intensive operations (CSV import) | No limit beyond the general limiter, the size and row bounds, and the job timeout (ADR-008 points 7 and 10) | `Planned (B4)` |

Code vs ADR:

- A request over a limit returns 429 `RATE_LIMITED` in the standard error envelope with the `RateLimit` headers of draft 7; the legacy `X-RateLimit-*` headers are off. The full view is `09-security-spec.md` §26.
- CI does not break: both limiters are skipped when `NODE_ENV=test`, which `.env.test.example` sets, and `rate-limit.test.ts` checks the 429 response on an isolated limiter. The workflow itself is `Planned (B0)`.
- Local development is not exempt. Only `NODE_ENV=test` skips the limiters, so a developer who mistypes a password five times, or a script that sends more than 300 requests in 15 minutes, gets 429 until the window ends. The counters are in memory, so restarting the API clears them. Decided (ADR-006, Deferred detail; B0): the limits stay on in development, and restarting the API clears the counters. The restart is documented in the troubleshooting list (§75).
- The store is per process and the key is the client IP. The API sets no `trust proxy`, so behind a proxy every client would share one address (§32). Neither matters while the stack is one local instance (ADR-006 points 1 and 2); both need a decision before a hosted backend (§67).
- The limits are not environment variables. Changing a value is a code change; no ADR asks for configurable limits.

---

# 64. Public Demo Traffic

**Status:** `Planned (FE)`; the bounds `Deferred`

Public traffic must be treated as untrusted.

The application should protect against:

- arbitrary file access
- unauthorized administration
- private data access
- uncontrolled resource consumption
- abusive simulation requests

Demo resources should remain bounded.

Public traffic reaches only the static demo (ADR-006 points 1 and 2). No public backend exists, so no request from the public internet reaches the API or the database:

| Threat | How the decided design handles it | Status |
|---|---|---|
| Arbitrary file access | The demo is static files under a subpath of the portfolio site, served by that host; the API serves no files (§61) | `Planned (FE)` |
| Unauthorized administration | No server operation exists to reach. The demo role selector runs the permission checks in process, for parity and not for security (ADR-005 point 11; §24) | `Planned (FE)` |
| Private data access | The demo bundles synthetic data only (§24, §56) | `Planned (FE)`; the data layers `Deferred` |
| Uncontrolled resource consumption | The demo's cost falls on the visitor's browser. No server resource is consumed, and the hosting of the portfolio site is outside this project's control (§28) | `Planned (FE)` |
| Abusive simulation requests | The simulator runs in the visitor's browser, so a request affects only that tab. In real mode, simulation control needs `simulation:control` and falls under the general limiter (ADR-007 point 10, §63) | Demo `Planned (FE)`; real mode `Planned (B5)` |
| Unbounded demo resources | No ADR sets a bound on retained ticks, events or stored state | `Deferred` |

Code vs ADR:

- This section overlaps §24, which keeps the exposure view; this one keeps the traffic view. They agree: the demo has no credentials and no server.
- The real-mode API is reachable only on the author's machine. Treating its traffic as untrusted still applies to a demonstration on a shared network: CORS is limited to `CORS_ORIGIN`, the limiters apply (`09-security-spec.md` §26) and the business routes need an access token (`authenticate`, ADR-005). `Planned (B7)` covers the unbound PostgreSQL port (§6).
- `Deferred` (frontend-stage ADR): the numeric bound on the demo's retained history is decided in that ADR with the other demo specifics (ADR-010 point 6; ADR-006 point 7), as §24 already records.

---

# 65. Resource Limits

**Status:** per item (table below)

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

| Limit | Today or decided | Status |
|---|---|---|
| Request body size | 100 kB (`JSON_BODY_LIMIT`); over it returns 413 `VALIDATION_ERROR` (`apps/api/src/app.ts`, `apps/api/src/middleware/error-handler.ts`) | `Implemented` |
| Upload size | CSV size and row count, values fixed in B4 (ADR-008 point 10) | `Planned (B4)` |
| Pagination size | `pageSize` 1 to 100, default 20 (`apps/api/src/schemas/pagination.schema.ts`); batch `assetIds` 1 to 50; at most 5 scenarios compared (`scenario.schema.ts`) | `Implemented` |
| Analytics query scope | Periods are enumerated and a custom range is validated (ADR-004). No maximum range or portfolio size is decided | `Deferred` |
| Background job duration | A timeout per job type while `QUEUED` or validating; the apply stage is exempt (ADR-008 point 7); values fixed in B4 | `Planned (B4)` |
| Realtime limits | 50 subscriptions, 20 inbound messages per second and a 1 MB outbound buffer per connection; 5 connections per user (ADR-007 point 15, ADR-005 point 13) | `Planned (B5)` |
| Realtime history | `MarketEvent` retention is bounded, the limit fixed in B5 (ADR-007 point 8); the client keeps no event history (`08-realtime-spec.md` §51) | `Planned (B5)`; client `Planned (FE)` |
| Demo history | No bound is decided (§24) | `Deferred` |
| Database query limits | No statement timeout or row cap is configured; Prisma's pool timeout applies (§66) | `Deferred` |
| API container memory | 512 MB in the `full` profile (NFR-054) | `Planned (B7)` |

Code vs ADR:

- The API has no server request timeout in version 1; the 15 s client timeout covers the user (ADR-002 point 10, NFR-017; the client policy is decided in the frontend-stage ADR, ADR-006 point 11). Node.js defaults cap the request line and headers (431).
- Decided (ADR-007, Deferred detail; `Planned (B5)`): the WebSocket `maxPayload` starts at 64 KiB (65,536 bytes) per inbound message (amended 2026-10-08), an initial value adjustable during B5 if a measured need appears.
- The reason for the value: the `ws` library accepts messages up to 100 MiB unless `maxPayload` is set (`09-security-spec.md` §27), and the client sends only tiny messages (`AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE`, ping and pong).
- These limits protect the local stack. A public backend would need them reviewed against its real capacity (ADR-006 point 2).

---

# 66. Database Pooling

**Status:** `Implemented` with Prisma's default pool; explicit values `Deferred`

The backend should use controlled PostgreSQL connection pooling.

Pool size must reflect the actual deployment capacity.

It should not exceed what the database instance can safely support.

Exact values are implementation decisions, not universal performance guarantees.

| Item | Today | Status |
|---|---|---|
| One shared client | `packages/database/src/client.ts` exports one `PrismaClient` singleton, reused across hot reloads, so one process holds one pool | `Implemented` |
| Pool size | Not configured. `DATABASE_URL` carries no `connection_limit` and `schema.prisma` has no pool setting, so Prisma 6 applies its default of `num_physical_cpus * 2 + 1` connections | `Implemented` as the default |
| Pool timeout | Not configured; the Prisma 6 default is 10 seconds to obtain a connection | `Implemented` as the default |
| PostgreSQL capacity | `docker-compose.yml` sets no `max_connections`, so the `postgres:18` default applies (100) | `Implemented` as the default |
| Explicit pool configuration | No values are decided; `connection_limit` stays at Prisma's default until measured (ADR-006, Deferred detail) | `Deferred` |
| Pool health | No separate check; readiness runs `SELECT 1` through the same client (`13-observability-spec.md` §21) | `Implemented` |

Code vs ADR:

- One API process, one pool, one local database: the default stays far below the PostgreSQL limit, which is why no ADR sets a value. The defaults come from the Prisma 6 documentation, and the installed version is `^6.0.0` (`packages/database/package.json`).
- The test suites of `apps/api` and `packages/database` each create their own client and pool against the test database. Running both together adds their pools to the total, still well below the limit.
- Decided (ADR-006, Deferred detail; B7): `connection_limit` of the `full` profile stays at Prisma's default until measured. Revisit if the API ever runs as several instances (§67), because each instance would open its own pool.
- The migration command (`prisma migrate deploy`, B7) opens its own short-lived connection and is not part of the runtime pool.

---

# 67. Horizontal Scaling

**Status:** `Deferred`: ADR-006 decides one local instance

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

The topology above is not a target. ADR-006 points 1 and 2 decide one local API instance and no hosted backend, and the `full` profile runs one `api` service. Several instances need a new ADR. The process-local assumptions that exist or are decided today:

| State | Where it lives | With several instances | Status |
|---|---|---|---|
| Access tokens | Stateless JWT signed with `JWT_SECRET` (`apps/api/src/config/env.ts`) | Safe if every instance shares the secret | `Implemented` |
| Rate-limit counters | In memory, per process (`rate-limit.ts`) | Each instance counts apart, so the effective limit multiplies; the client IP is also hidden behind a proxy (§63) | `Implemented` |
| Market simulator and tick sequence | Runs inside the API process, with in-memory sequences (ADR-007 point 7 and Deferred detail) | Each instance would run its own simulator and emit conflicting prices | `Planned (B5)` |
| WebSocket connections and the per-user cap of 5 | In memory, per process (ADR-005 point 13) | The cap would count per instance | `Planned (B5)` |
| Job runner | In process, backed by the `jobs` table; transitions are compare-and-set (ADR-008 point 4, Deferred detail) | The compare-and-set limits duplicate execution; startup resume by two instances is not designed | `Planned (B4)` |
| Idempotency keys and database state | PostgreSQL (ADR-008 point 8) | Shared by every instance | `Planned (B4)` |

Code vs ADR:

- "Avoid unnecessary process-local assumptions" is kept as guidance. The assumptions in the table are not accidental: ADR-007 puts the simulator in the API process and ADR-008 puts the runner there, both because the target is one local instance.
- No code is written to prepare for several instances, and none should be until a decision asks for it (NFR-070, avoid artificial complexity).

---

# 68. Realtime Scaling Boundary

**Status:** `Deferred`; the transport port `Planned (B5)`

A multi-instance WebSocket deployment may require a shared event mechanism:

```text
API instances
      ↓
Realtime broker/pub-sub
      ↓
Connected clients
```

The current realtime implementation should remain behind an abstraction to permit this evolution.

| Item | Status |
|---|---|
| WebSocket library `ws` behind a transport port (ADR-007 point 1) | `Planned (B5)` |
| Realtime hub behind its own interface, separate from `ws`; no broker in version 1 (ADR-007, Deferred detail) | `Planned (B5)` |
| Single API process: simulator, connections and sequences in memory (§67) | `Planned (B5)` |
| Realtime broker or pub-sub between instances | `Deferred` |
| Per-process epoch in the envelope, so a client resets its baseline after a server restart (ADR-007, Deferred detail) | `Planned (B5)` |

Code vs ADR:

- No realtime code exists. The transport port of ADR-007 point 1 separates the code from the `ws` library. The interface of the hub, decided in the Deferred detail of ADR-007, is the publish interface for fan-out, which is what a broker would replace.
- Decided (ADR-007, Deferred detail; `Planned (B5)`): the hub that delivers events to subscribed sockets sits behind its own interface, separate from `ws`, and version 1 has no broker, so one could later stand behind that interface.
- The epoch field already treats a restart as a reset, which is the same recovery a broker-based design would need; clients resynchronize through HTTP on a gap (ADR-007 point 5).

---

# 69. CDN and Static Assets

**Status:** `Planned (FE)` for the demo build; the caching headers and any CDN `Deferred`

The frontend should be compatible with CDN/static hosting.

Use:

- content-hashed assets
- cacheable immutable files
- controlled HTML caching
- explicit API origin configuration

Exact caching headers depend on the host.

| Item | Status |
|---|---|
| Static build of `apps/web` that a plain static host can serve (ADR-006 point 7) | `Planned (FE)` |
| Content-hashed assets and cacheable immutable files | `Planned (FE)`: a property of the web build, which does not exist yet |
| Controlled HTML caching and caching headers | `Deferred`: they belong to the portfolio host, which this project does not control (NFR-025 accepted exception) |
| Explicit API origin configuration | Not needed by the public demo, which calls no backend (ADR-006 point 7); for the real mode, build-time `VITE_API_BASE_URL` and `VITE_WS_URL` (proposed names; ADR-006 point 8; §14): `Planned (FE)` |
| A CDN in front of the demo | `Deferred`: no ADR decides one |

Code vs ADR:

- ADR-006 decides that the demo is a static build under a subpath, not a CDN. The guidance above stays as a compatibility requirement on the build, and nothing here selects a CDN or a provider (§28).
- A configurable base path is part of the same decision (ADR-006 point 7), so asset URLs must resolve under the subpath. The base path value and how the build receives it are decided in the frontend-stage ADR (ADR-006 point 7, amended 2026-10-07; ADR-010 point 6) and stay `Deferred` until then. Recommendation for that ADR: a build-time setting beside `VITE_APP_MODE` (§23).

---

# 70. SPA Routing

**Status:** `Planned (FE)` (ADR-006 point 7); the host-specific fallback `Deferred` (frontend-stage ADR, ADR-010 point 6)

Static hosting must support client-side routes such as:

```text
/dashboard
/portfolio/123
/analytics
```

Unknown application paths should resolve to the frontend entry point rather than a server 404.

The required host-specific fallback must be documented.

| Item | Status |
|---|---|
| SPA fallback for the demo | `Planned (FE)`: decided in ADR-006 point 7 |
| The route paths | `Deferred`: the three paths above are examples. Frontend routing is not decided (`06-architecture.md`, `11-ui-ux-spec.md`) |
| The host-specific fallback documented | `Deferred`: the SPA fallback mechanism is decided in the frontend-stage ADR (ADR-006 point 7, amended 2026-10-07; ADR-010 point 6) |

Code vs ADR:

- The demo is hosted under a subpath of the portfolio site, so every route sits under the base path and the fallback must return the demo's entry point, not the portfolio's. Whether the portfolio host provides such a fallback is unconfirmed (§28); demo hosting and the fallback mechanism are decided in the frontend-stage ADR (ADR-010 point 6). Recommendation for that ADR: confirm it, and if the host cannot, record the alternative to use, for example a router that does not depend on server paths.
- The API has no SPA fallback and needs none: it serves JSON only, and an unknown route returns 404 `NOT_FOUND` in the error envelope (`apps/api/src/app.ts`).

---

# 71. API Versioning

**Status:** `Implemented` (ADR-002 point 8)

The API should have a consistent versioning strategy.

The strategy is decided:

```text
/api/v1/...
```

Final routes must remain aligned with `07-api-spec.md`.

| Item | Status |
|---|---|
| Every business route is under `/api/v1` (for example `auth.routes.ts`, `portfolios.routes.ts`) | `Implemented` |
| Unversioned operational routes: `GET /health`, `GET /health/ready` and `GET /` | `Implemented` (`07-api-spec.md` §3) |
| Only additive changes within `v1`; a breaking change needs a new version | `Implemented` as a rule (ADR-002 point 8) |
| Contracts as versioned schemas in `@trading/contracts` | `Planned (B0)` (ADR-002 points 1 and 8) |
| OpenAPI document generated from the schemas | `Planned (B6)` (ADR-002 point 7) |
| Version of the WebSocket endpoint | `Planned (B5)`: the endpoint has a fixed path, proposed `/ws` and confirmed in B5 (ADR-007 point 1; §72) |

Code vs ADR:

- The original text called `/api/v1` a possible initial strategy. ADR-002 point 8 decides it, and the code already follows it.
- The health routes sit outside `/api/v1` on purpose, so a probe does not depend on the API version (§50).

---

# 72. WebSocket Configuration

**Status:** per item (table below); nothing is built, the server is `Planned (B5)`

The WebSocket endpoint must be environment-aware.

Conceptually:

```text
Development:
ws://localhost:<port>/<path>

Production:
wss://<configured-domain>/<path>
```

The exact endpoint is finalized during implementation.

| Item | Decided or open | Status |
|---|---|---|
| Local stack endpoint | `ws://localhost:<PORT>/<path>` on the API's own server and port (7001 by default), no TLS (ADR-007 point 1, `09-security-spec.md` §31) | `Planned (B5)`; the path is fixed, proposed `/ws` and confirmed in B5 (ADR-007 point 1) |
| `wss://<configured-domain>/<path>` | Needs a hosted backend and TLS (ADR-006 point 2, §34) | `Deferred` |
| Variable for the path or URL | `WEBSOCKET_PATH` is not adopted: the path is fixed (ADR-007 point 1; §10). The client uses the build-time `VITE_WS_URL`, proposed name (ADR-006 point 8; §14) | Server: none. Client `Planned (FE)` |
| Library and boundary | `ws` behind a transport port (ADR-007 point 1) | `Planned (B5)` |
| Authentication | The access token travels in the first message, never in the URL; a socket not authenticated within 5 seconds closes with `4001` (ADR-007 point 2) | `Planned (B5)` |
| Close codes | `4001` unauthenticated or invalid token, `4002` token expired, `4008` limit exceeded, `1001` server going away (ADR-007 point 15) | `Planned (B5)` |
| Limits per connection | 50 subscriptions, 20 inbound messages per second, 64 KiB per inbound message, 1 MB outbound buffer (ADR-007 point 15 and its `maxPayload` amendment) | `Planned (B5)` |
| Concurrent connections | 5 per authenticated user, not per IP; at the cap, the new (excess) connection closes with `4008` and the existing connections stay open (ADR-005 point 13, ADR-007 point 16) | `Planned (B5)` |
| Maximum inbound message size | `maxPayload` starts at 64 KiB (65,536 bytes), adjustable during B5 (ADR-007, Deferred detail, amended 2026-10-08; §65) | `Planned (B5)` |
| Heartbeat | Ping every 30 seconds; close after 2 consecutive missed pongs, about 60 seconds (ADR-007 point 15) | `Planned (B5)` |
| Protocol messages | `AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE`; replies `ACK` and `ERROR` (ADR-007 point 15) | `Planned (B5)` |

Code vs ADR:

- No WebSocket code exists: `apps/api` has no `ws` dependency. The local development endpoint is therefore a decided shape, not a running URL.
- Decided (ADR-007 point 1, amended 2026-10-07; `Planned (B5)`), as recorded in §31: the WebSocket is served by the same HTTP server and port as the API (`PORT`, default 7001) on a fixed path, proposed `/ws` and confirmed in B5, so the full stack publishes one port. There is no `WEBSOCKET_PATH` variable.
- Decided (ADR-007 point 16, ADR-005 point 13; `Planned (B5)`): when a user is at the cap of 5, the new connection is closed with `4008` and the existing ones stay open.
- Open (B5): the close code for a missed-pong close (`08-realtime-spec.md` §7); whether the upgrade request's `Origin` is checked against `CORS_ORIGIN` (`09-security-spec.md` §31).
- ADR-007 point 15 assigns `1001` (server going away) to a server that is shutting down. §16 records it for the realtime step, which joins the shutdown sequence in B5 (ADR-006, Deferred detail).
- The demo has no socket: an in-process adapter implements the same client port (ADR-007 point 13, `Planned (FE)`).

---

# 73. Backups

**Status:** `Reference`: not applicable to the local environment (ADR-006 point 9)

Local development does not require formal backups.

A production-like persistent deployment should have a documented backup and restoration strategy if real user data exists.

The project must not claim backup coverage until it has actually been configured and tested.

| Item | Today | Status |
|---|---|---|
| Backup of the local database | None is configured, and none is claimed | `Reference` |
| Where the data lives | The named volume `trading-analytics-postgres-data` (`docker-compose.yml`) | `Implemented` |
| What destroys it | `docker compose down -v` removes the volume, and `pnpm --filter @trading/database db:reset` drops and recreates the database after a confirmation prompt | `Implemented` |
| Backup for a hosted database | No hosted database exists (ADR-006 point 2) | `Deferred` |

Code vs ADR:

- ADR-006 point 9 documents backups as not applicable to a local environment and forbids claiming them. The stack holds seed and demonstration data, which `db:seed` and `db:reset` recreate from the repository.
- The "production-like persistent deployment" of the original text is the local `full` profile (§57), which has no real user data, so the condition "if real user data exists" does not hold.
- If a real portfolio ever lives on the local volume, a backup becomes the author's decision. No command or schedule is specified here.

---

# 74. Disaster Recovery

**Status:** `Reference`: enterprise recovery is out of scope; the sequence applies as described below

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

For the local stack the first step is a rebuild, because no backup exists (§73):

| Step | Local stack | Status |
|---|---|---|
| Restore database | Recreate it from the repository: start PostgreSQL and run `pnpm --filter @trading/database db:reset`, which reapplies every migration and reseeds | `Implemented` for development |
| Run compatible application | The commit that matches the migrations; there are no down migrations, so recovery goes forward (ADR-006 point 6, §47) | `Reference` |
| Validate migrations | `prisma migrate deploy`, run by the one-shot `migrate` service before the API starts in the full stack | `Planned (B7)` (ADR-006 points 4 and 5) |
| Start services | `docker compose --profile full up` | `Planned (B7)` |
| Health checks | `GET /health` and `GET /health/ready` (§50) | `Implemented` |
| Smoke tests | The B7 smoke test (§49) | `Planned (B7)` |

Code vs ADR:

- `db:reset` is a development command: it is destructive by design and runs the seed. ADR-006 point 5 says the seed never runs automatically in the full stack, so a recovery there applies the migrations and runs the seed as a separate, explicit step.
- Restoring a dump is not described because no backup exists. If one is ever configured, this section gains that step and its test (§73).

---

# 75. Troubleshooting

**Status:** `Reference`; the developer-facing workflow `Planned (B3)` (`13-observability-spec.md` §36), the README entries pending (T5.2)

Documentation should cover common failures.

The checks below name the commands and routes that exist today. Items about code that is not built are marked.

### Database unavailable

Check:

- PostgreSQL service: `docker compose ps`, and `docker compose logs postgres` for the reason; the container has a `pg_isready` healthcheck
- connection URL: `DATABASE_URL` in `.env` must repeat the user, password, port and database of the Compose variables, and nothing keeps them in step (§6)
- credentials: the Compose fallback password differs from the `.env.example` placeholder (§6)
- network: the published port is `DATABASE_PORT` (default 5432); another local PostgreSQL on that port is a common clash
- readiness: `GET /health/ready` returns 503 with `checks.database: "unavailable"`; the cause is in the API's `health.database.unavailable` log line, which carries the error name and no driver message

A request that needs the database while it is down returns 500 `INTERNAL_ERROR` today; 503 `DEPENDENCY_ERROR` is `Planned (B0)`.

### Backend does not start

Check:

- environment variables: an invalid value stops the process with `[api] invalid environment configuration:`, the key and the rule, and exit code 1 (`apps/api/src/config/env.ts`, §12). `JWT_SECRET` needs at least 32 characters
- Node.js version: `engines.node` is `>=22.0.0` today; the `.nvmrc` pin is `Planned (B0)` (ADR-006 point 13, §59)
- build output: `pnpm --filter @trading/api start` runs `node dist/index.js`, which does not work until the production build exists (`Planned (B7)`); use `pnpm --filter @trading/api dev` (`tsx watch`) meanwhile
- migration state: apply migrations with `pnpm --filter @trading/database db:migrate` (development); `db:reset` rebuilds the database from scratch
- the port: `PORT` (default 7001) may already be in use
- logs: today a startup line and error lines on stdout; structured startup entries are `Planned (B3)` (§52)

### Login returns 429

The login limiter allows 5 attempts per 15 minutes per IP, and the general limiter 300 requests (§63). Both are skipped under `NODE_ENV=test`. The counters are in memory, so restarting the API clears them.

### Frontend cannot reach API

`Planned (FE)`: there is no frontend yet. When it exists, check:

- API base URL: the build-time `VITE_API_BASE_URL` (proposed name, ADR-006 point 8; §14)
- CORS: the browser origin must appear in `CORS_ORIGIN` (default `http://localhost:5173`); a mismatch is a browser error and not an API error
- backend health: `GET /health`
- browser network panel: the `X-Request-ID` header of a failing request identifies it in the API logs; exposing it to browser code through CORS is `Planned (B3)` (ADR-009 point 5)

### WebSocket fails

`Planned (B5)`: there is no WebSocket server yet. When it exists, check:

- endpoint: the fixed path, proposed `/ws` and confirmed in B5, and the build-time `VITE_WS_URL` (§72)
- WS/WSS scheme: the local stack uses `ws://`, and WSS is `Deferred` (§34)
- proxy support: the local stack has no proxy (§32)
- server upgrade support: the socket shares the API port (ADR-007 point 1, §72)
- browser console: close codes `4001`, `4002` and `4008` identify an authentication failure, an expired token and a limit (§72)
- reconnect diagnostics: client diagnostics are `Planned (FE)` (`08-realtime-spec.md` §27)

Code vs ADR:

- The original four headings are kept and extended with the real commands. The developer-facing troubleshooting document is `13-observability-spec.md` §36, which `Planned (B3)` assigns; `README.md` and `CONTRIBUTING.md` document neither the API start nor these checks, and are aligned in T5.2.
- `.env.test.example` points at a test database (`trading_analytics_test`) that must be created by hand (§6); a test run that cannot connect usually means it is missing, or `pnpm --filter @trading/database db:test:migrate` has not run.

---

# 76. Local Setup

**Status:** per step (table below); the frontend step `Planned (FE)`; the repository documentation of these steps pending (T5.2)

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

| Step | Command or action | Status |
|---|---|---|
| Clone | Node.js `>=22`, pnpm through corepack (`package.json` `engines`, `packageManager`) | `Implemented` |
| Install dependencies | `pnpm install` | `Implemented` |
| Create environment file | Copy `.env.example` to `.env`, then set `JWT_SECRET` (at least 32 characters) and a `DATABASE_URL` that matches the Compose variables (§10, §11) | `Implemented` |
| Start PostgreSQL | `docker compose up -d` | `Implemented` |
| Run migrations | `pnpm --filter @trading/database db:migrate` (`prisma migrate dev`) | `Implemented` |
| Seed development data | `pnpm --filter @trading/database db:seed`; never automatic (ADR-006 point 5, §20) | `Implemented` |
| Start backend | `pnpm --filter @trading/api dev` | `Implemented` |
| Start frontend | No frontend exists | `Planned (FE)` |
| Open application | The API answers `GET /` and `GET /health` on port 7001; the application is the frontend | API `Implemented`; UI `Planned (FE)` |

Optional checks, as in `README.md` and `package.json`: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` and `pnpm docs:check`. Tests need `.env.test.local` copied from `.env.test.example` and a separate test database (§11).

Code vs ADR:

- `README.md` lists `pnpm install` and `pnpm typecheck` as setup, says the API is "not started yet" and has no environment, API or health step. `CONTRIBUTING.md` documents none of these either. Both are stale and are aligned in T5.2.
- The `db:migrate` and `db:seed` scripts load `.env` through `dotenv-cli` (`packages/database/package.json`), so the environment file and its `DATABASE_URL` belong before step "Run migrations".
- The development flow runs the API on the host, against the PostgreSQL container's published port. The all-containers flow is the `full` profile (§57, `Planned (B7)`).

---

# 77. Production Setup

**Status:** local full stack `Planned (B7)`; demo publishing `Planned (FE)`; hosted steps `Deferred` (ADR-006 point 2)

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

"Production-like" is the local full stack, with the demo published separately (ADR-006 point 1). The steps map as follows:

| Step | Local full stack or demo | Status |
|---|---|---|
| Provision infrastructure | Docker on the author's machine; no hosting, managed database or reverse proxy (§29, §30, §32) | Local `Implemented`; hosted `Deferred` |
| Configure secrets | The git-ignored `.env`, with `NODE_ENV=development`, `DATABASE_URL`, `JWT_SECRET` and the optional `PORT` and `CORS_ORIGIN` (§11, §13) | `Planned (B7)` |
| Build artifacts | `pnpm build` and the API image; the compiled output must run with `node dist/index.js` (ADR-006 points 3 and 4) | `Planned (B7)` |
| Run migrations | `prisma migrate deploy` in the one-shot `migrate` service, before the API starts (ADR-006 points 4 and 5) | `Planned (B7)` |
| Start backend | `docker compose --profile full up` (§57) | `Planned (B7)` |
| Deploy frontend | Publish the static demo build under the portfolio subpath; how it reaches the host is decided in the frontend-stage ADR (ADR-010 point 6; §22) | `Planned (FE)`; mechanism `Deferred` |
| Verify health | `GET /health` and `GET /health/ready` (§48, §50) | Routes `Implemented`; the procedure `Planned (B7)` |
| Verify realtime | Connect to the local WebSocket server (§72) | `Planned (B5)` |
| Run smoke tests | The B7 smoke test, from a clean checkout (§49, NFR-055) | `Planned (B7)` |

Code vs ADR:

- The sequence is the original text. Its "provision" and "deploy" steps presume a hosted backend, which ADR-006 point 2 removes. None of the steps run today: there is no `full` profile, no Dockerfile and no runnable production build (ADR-006 context).
- Order matters between migration and start: the Compose healthcheck dependency (`condition: service_healthy`) keeps `migrate deploy` from running before PostgreSQL accepts connections (ADR-006, Deferred detail, B7).
- The seed does not appear in this sequence, because it never runs automatically (ADR-006 point 5).

---

# 78. Security Checklist

**Status:** per item (tags below)

Before public deployment:

ADR-006 point 2 hosts no backend, so "public deployment" means two things: publishing the static demo build, and running the local full stack for a demonstration. Items that need a hosted backend are `Deferred`. Each item ends with its status and, where it is not built, the block or stage that delivers it. `09-security-spec.md` holds the detail and NFR-024 cites this list. Checked items are those whose behavior exists in the repository today.

- [x] No secrets committed. (`Implemented` by convention: `.env`, `.env.local` and `.env.*.local` are git-ignored and only the `*.example` files are tracked; no secret scanner exists, and CI itself is `Planned (B0)`, §13)
- [x] Production JWT secret configured. (`Implemented` as a rule: `JWT_SECRET` has no default and needs at least 32 characters, `apps/api/src/config/env.ts`; supplying a real value in the `full` profile is `Planned (B7)`)
- [ ] Database credentials protected. (Partly: `.env` is ignored, but the Compose fallback password is a known local value, the API connects as a superuser and the port is published on every host interface. Runtime role `Planned (B0)`, binding open in B7, §6)
- [x] CORS restricted. (`Implemented`: `CORS_ORIGIN`, default `http://localhost:5173`, `apps/api/src/app.ts`)
- [ ] HTTPS enabled. (`Deferred`: the local stack uses plain HTTP and `ws://`; the demo's HTTPS comes from the portfolio host, `Planned (FE)`, §28, §34)
- [ ] Debug mode disabled. (No debug switch exists. `LOG_LEVEL` defaults to `info` in production, `Planned (B3)`; `ENABLE_DEBUG_LOGGING` is not adopted, §10)
- [x] Stack traces hidden. (`Implemented`: the error handler returns a generic 500 body and logs the error name only, `apps/api/src/middleware/error-handler.ts`)
- [x] Health output sanitized. (`Implemented`: fixed fields and `ok` or `unavailable`, `apps/api/src/controllers/health.controller.ts`, §50)
- [x] Metrics restricted if exposed. (Satisfied by absence: no metrics and no `/metrics` endpoint, `Deferred`, ADR-009 point 10)
- [ ] Admin operations protected. (the `Actor` permission mechanism `Planned (B0)` and the roles of ADR-005 `Planned (B2)`; simulation control `Planned (B5)`; the code carries the role in the token but no route checks it yet)
- [x] Rate limits considered. (`Implemented`, §63)
- [ ] Resource limits configured. (Partly: body size and pagination `Implemented`; CSV, realtime and job limits `Planned (B4)` and `Planned (B5)`; the 512 MB container limit `Planned (B7)`, §65, NFR-054)
- [ ] Demo data isolated. (`Planned (FE)`: the demo has no backend and no database, §24, §56)
- [ ] Dependencies reviewed. (Lockfile and review `Implemented`; the manual `pnpm audit --prod --audit-level=high` step `Planned (B7)`, §58)

Code vs ADR:

- The original heading read "Before public deployment" and assumed a public backend. The two readings above replace it; a hosted backend would need a new ADR and a review of every item (ADR-006 point 2).
- ADR-005 point 13 adds two items the original list lacks: a separate runtime database role and equalized login timing, both `Planned (B0)`. The checklist does not list them; ADR-005 point 13 and `09-security-spec.md` track them.
- "Admin operations protected" cannot be checked until B2: the code roles are `USER` and `ADMIN`, ADR-005 decides `VIEWER`, `TRADER` and `ADMIN`, and no role check exists in `apps/api` today.

---

# 79. Performance Checklist

**Status:** per item (tags below)

Before deployment:

Each item ends with its status and, where it is not built, the block or stage that delivers it. Checked items are those whose behavior exists today.

- [ ] Production frontend build succeeds. (`Planned (FE)`: no web code exists)
- [ ] Production backend build succeeds. (`pnpm build` compiles every package with `tsc --build`, but the output does not run, so the item stays open: running it is `Planned (B7)`; building in CI is `Planned (B0)`, ADR-006 points 3 and 11)
- [ ] Development dependencies excluded where appropriate. (`Planned (B7)`: the multi-stage image, ADR-006 point 4)
- [ ] Static assets optimized. (`Planned (FE)`, §69)
- [x] Required indexes exist. (`Implemented`: `@@index` and `@@unique` declarations in `packages/database/prisma/schema.prisma`; whether they cover every query is not reviewed, `05-data-model.md`)
- [x] Pagination limits enforced. (`Implemented`: `pageSize` at most 100 on the paginated lists, §65)
- [ ] Realtime history bounded. (`Planned (B5)`: `MarketEvent` retention, ADR-007 point 8; the client window `Planned (FE)`)
- [ ] Background jobs have timeouts. (`Planned (B4)`: ADR-008 point 7)
- [ ] Logging volume controlled. (`Planned (B3)`: one JSON line per event at a level set by `LOG_LEVEL`, with `info` in production, ADR-009 points 3 and 7)

No performance claim should be published without actual measurement.

Code vs ADR:

- The targets that a measurement would check are in `03-non-functional-requirements.md` (NFR-001 onward) and are not repeated here.
- The slow-request threshold (`SLOW_REQUEST_THRESHOLD_MS`, default 500) is how a slow request becomes visible, `Planned (B3)` (ADR-009 point 8, §10).
- No benchmark, load test or profile exists in the repository.

---

# 80. Deployment Observability Checklist

**Status:** per item (tags below); split by scope as ADR-009 point 12 requires

Verify:

The backend items close in B3, except where a tag names another block. Frontend and demo items belong to the frontend stage, and metrics are `Deferred` (ADR-009 points 10 and 12; `13-observability-spec.md` §74, which owns the full definition of done). Checked items exist today.

- [ ] startup logs. (`Planned (B3)`: `app.startup.started` and `app.startup.completed`, ADR-009 point 11; their level is open; today one `console.log` line announces the port, §52)
- [x] request IDs. (`Implemented`: `X-Request-ID` assigned or reused, echoed and present in error bodies, `apps/api/src/middleware/request-id.ts`; propagation to every log line `Planned (B3)`)
- [x] error logging. (`Implemented` as the `request.failed` line from the error handler; `http.request.failed` `Planned (B3)`, ADR-009 point 6)
- [x] health endpoint. (`Implemented`, §50)
- [x] readiness checks. (`Implemented`, §50; 503 with `status: "unavailable"` and no `checks` while shutting down `Planned (B3)`, ADR-006 point 12; the route test `Planned (B0)`, ADR-001 point 8)
- [x] database health. (`Implemented`: `SELECT 1` through the shared client; a recovery entry is `Deferred` until a poller exists, B7, `13-observability-spec.md` §58)
- [ ] realtime lifecycle diagnostics. (`Planned (B5)` on the server and `Planned (FE)` on the client; names open, ADR-009 point 11)
- [ ] background job diagnostics. (`Planned (B4)`: entry names and fields are open)
- [ ] metrics where implemented. (`Deferred`: none exist, ADR-009 point 10)
- [ ] safe production log level. (`Planned (B3)`: `LOG_LEVEL` is `info` in production and `silent` in tests, ADR-009 point 7; the variable is not read yet)

Code vs ADR:

- ADR-009 point 12 limits B3 to the backend, and `13-observability-spec.md` §74 splits its checklist by block. This checklist is the deployment view of the same items; it must not be closed ahead of them.
- The `app.shutdown.started` and `app.shutdown.completed` entries (ADR-006 point 12) and the `app.startup.started` and `app.startup.completed` entries (ADR-009 point 11) are not in the original list. They are `Planned (B3)`, and the 503 readiness response while shutting down belongs to the same item (§16).
- Log shipping, dashboards and alerting are `Deferred` with the hosted backend (§53).

---

# 81. Deployment Testing Matrix

**Status:** `Reference` for the matrix; per row status in the table below

Columns follow the environments of §3: Local is a developer machine with the default Compose profile, CI is the GitHub Actions workflow of §41, Demo is the static build of `apps/web`, and Production-like is the local `full` Compose profile (ADR-006 points 1 and 4).

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

What each row is in version 1:

| Test | Today or decided | Status |
|---|---|---|
| Unit | The domain suite runs with `vitest` (`packages/domain`). Application-service tests with in-memory fakes join with the application layer (ADR-001 point 7) | Domain `Implemented`; application services `Planned (B0)`; in CI `Planned (B0)` |
| Integration | The API route tests (`apps/api/src/routes/*.routes.test.ts`, supertest) and the `@trading/database` suite run against the test database (`.env.test.local`). `analytics`, `positions`, `assets` and `market` have no route test file yet (`10-testing-strategy.md` §59). In CI the database is a PostgreSQL service container (§42). The demo has no backend, and no integration suite runs against the `full` stack: the smoke test (§49) is its check | Local partly `Implemented`; missing route tests `Planned (B0)` (ADR-001 point 8); in CI `Planned (B0)`; production-like through the smoke test `Planned (B7)` |
| E2E | No frontend code exists. The component runner, Playwright and the accessibility tool are chosen in the frontend-stage ADR and join the CI workflow once frontend code exists (ADR-006 point 11). The critical flows are in `10-testing-strategy.md` §33-34. The `full` stack has no frontend container (§7), so what an E2E run targets there is open | `Planned (FE)`; tools `Deferred`; production-like open (B7) |
| Migrations | `db:migrate` (`prisma migrate dev`) locally and `db:test:migrate` (`prisma migrate deploy`) for the test database, both in `packages/database/package.json`. CI migrates its service container before the suites (§42). The `full` profile runs `prisma migrate deploy` at startup (ADR-006 point 5). The demo has no database | Local `Implemented`; CI `Planned (B0)`; production-like `Planned (B7)`; demo not applicable |
| Health | `GET /health` and `GET /health/ready` (§50). No route test exists yet (ADR-001 point 8). The API container healthcheck is §51. The demo is a static build with no health endpoint (`13-observability-spec.md` §65) | Routes `Implemented`; route test `Planned (B0)`; container healthcheck `Planned (B7)`; demo not applicable |
| Realtime | Server tests with the WebSocket server (ADR-007); client states and reconnect in the web app. The demo uses the in-process adapter behind the same client port (ADR-007 point 13) | Server `Planned (B5)`; client and demo `Planned (FE)` |
| Demo simulation | One engine, `@trading/market-sim`, serves the API and the demo, with a seeded generator and an injected clock (ADR-007 point 7). The demo specifics wait for the frontend-stage ADR (ADR-010 point 6) | Engine `Planned (B5)`; demo `Planned (FE)` |
| Production build | `pnpm build` runs `tsc --build` in each package and passes today, but its output does not run (ADR-006 context). CI runs `pnpm build` to prove a clean checkout compiles (ADR-006 point 11). Running `node dist/index.js` is B7. The web build of the demo is separate (§27) | Compile `Implemented`; in CI `Planned (B0)`; runnable `Planned (B7)`; web build `Planned (FE)` |
| Smoke tests | One script run after `docker compose --profile full up`, with no frontend step (ADR-006 point 11, additions of 2026-10-07; §49). CI does not run it, because running the built API stays B7 (ADR-006 point 11) | Full stack `Planned (B7)`; demo `Planned (FE)` |

Code vs ADR:

- The matrix is the original. Four cells do not hold under ADR-006: E2E in Local and CI (no frontend code, tools `Deferred`), Integration and E2E in Production-like (no suite targets the `full` stack, and it has no frontend container), and Health in Demo (a static build has no endpoint). The ticks in the CI column mean the stage runs in the workflow of §41, which has no E2E, no smoke test and no coverage stage.
- Production build in CI is a compile check only. "Production-like" is the author's machine, not a hosted environment (ADR-006 point 2), so no column runs against a deployed backend.
- The matrix says nothing about the pull request gate; that is `10-testing-strategy.md` §54, which also lists no coverage threshold (ADR-006 point 11).

---

# 82. Deployment Acceptance Criteria

**Status:** `Reference`; per-criterion status below

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

| # | Status | Basis |
|---|---|---|
| 1 | Partly `Implemented` | `README.md` documents Compose, the seed and the reset; it does not document starting the API, the environment files or the health routes. Per-environment documentation is `Planned (B0)` (§11) and the repository documentation is T5.2 (§76) |
| 2 | `Implemented` | `docker-compose.yml`: `postgres:18`, a named volume and a `pg_isready` healthcheck (§6, §30) |
| 3 | `Implemented` | Committed Prisma migrations in `packages/database/prisma/migrations/`; applied from a clean checkout in CI `Planned (B0)` and at startup of the `full` profile `Planned (B7)` (§18) |
| 4 | Backend compile `Implemented`; runnable backend `Planned (B7)`; frontend `Planned (FE)` | `pnpm build` compiles every package but the output does not run (ADR-006 point 3); `apps/web` has no `package.json` (§44) |
| 5 | `Implemented` | `apps/api/src/config/env.ts` and the `.env*` files (§10-§12); `DATABASE_URL` is not validated there (`Planned (B7)`) |
| 6 | `Implemented` by convention | `.env`, `.env.local` and `.env.*.local` are git-ignored and only `*.example` files are tracked; no scanner exists (§78) |
| 7 | `Implemented`; shutdown behavior `Planned (B3)` | `GET /health` and `GET /health/ready` (NFR-051, §50); readiness returns 503 while shutting down (ADR-006 point 12) |
| 8 | `Planned (B5)` locally; hosted `Deferred` | The supported environment is the local full stack, over `ws://` (§31, §34). Public WSS needs a hosted backend, which ADR-006 point 2 excludes |
| 9 | `Planned (FE)` | The demo is a static build with no backend and no secrets (ADR-006 point 7); NFR-052 and NFR-067 |
| 10 | `Planned (B0)` | The workflow of §41 installs from the lockfile; ADR-006 point 10 |
| 11 | `Planned (B7)` | The `full` profile (ADR-006 point 4, §57); NFR-055 measures it by `docker compose --profile full up` passing the smoke test from a clean checkout |
| 12 | `Planned (B3)` for logs; health `Implemented` | Request IDs are `Implemented`; structured logs, startup and shutdown entries are B3 (§52, §80) |
| 13 | `Reference` | Forward-fix only (ADR-006 point 6, §47). "Documented" means that statement; no rollback procedure exists or is promised |
| 14 | `Implemented` by absence | No hosting provider is named and no vendor-specific code exists in `apps/` or `packages/`; the demo sits under the author's portfolio site (§28, §87) |

Code vs ADR:

- Criterion 8 is satisfied only for the local stack. "The supported deployment environment" is the full stack of ADR-006 point 1; no other environment supports WebSockets, because none hosts a backend.
- Criterion 13 changes meaning: the original asked for rollback considerations, and ADR-006 point 6 removes controlled rollback. The criterion holds by documenting that choice.
- No criterion may be closed ahead of the block that delivers it. B0 closes 10, B3 closes 12 and the shutdown part of 7, B5 closes 8, B7 closes 4 and 11, and the frontend stage closes 4 and 9.
- NFR-055 is the measurable form of criteria 3, 4, 10 and 11; NFR-024 cites the security checklist of §78; NFR-051 measures criterion 7 with health route tests that do not exist yet (`Planned (B0)`, ADR-001 point 8).

---

# 83. Definition of Done

**Status:** per item (tags below)

Each item ends with its status and, where it is not built, the block or stage that delivers it. Checked items are those whose behavior exists, or that are decided, today. The checklist is not closed ahead of its blocks.

### Local
- [ ] Docker setup implemented. (Partly: the `postgres` service `Implemented`; the `full` profile and the API Dockerfile `Planned (B7)`, §5, §6)
- [x] PostgreSQL reproducible. (`Implemented`: `postgres:18`, named volume, healthcheck)
- [ ] frontend starts. (`Planned (FE)`: no web code exists)
- [x] backend starts. (`Implemented`: `pnpm --filter @trading/api dev`, §76)
- [ ] WebSockets work. (`Planned (B5)`)
- [ ] environment setup documented. (Partly: `.env.example` and `.env.test.example` are tracked; `README.md` does not cover starting the API (T5.2); per-environment documentation `Planned (B0)`, §11)

### Database
- [x] migration system implemented. (`Implemented`: Prisma Migrate, `packages/database/prisma/migrations/`, §18)
- [x] seed process documented. (`Implemented`: `db:seed` in `README.md` and §20; it never runs automatically, ADR-006 point 5)
- [x] reset process documented. (`Implemented`: `db:reset` in `README.md` and §21)
- [x] database version pinned. (`Implemented` at major version: `postgres:18` in `docker-compose.yml`; the CI service container version is open (B0), §42)

### Build
- [ ] frontend production build works. (`Planned (FE)`, §27)
- [ ] backend production build works. (The compile `Implemented`; running the output `Planned (B7)`, §79)
- [x] lockfile committed. (`Implemented`: `pnpm-lock.yaml`; `--frozen-lockfile` in CI `Planned (B0)`)
- [ ] runtime versions documented. (Partly: `engines.node` is `>=22.0.0` and `packageManager` is pinned in `package.json`; no `.nvmrc` yet, the pin is decided and `Planned (B0)`, ADR-006 point 13, §59)

### CI
- [ ] lint passes. (`Planned (B0)`: `pnpm lint`, ADR-006 point 10)
- [ ] type checking passes. (`Planned (B0)`: `pnpm typecheck`)
- [ ] unit tests pass. (`Planned (B0)`: `pnpm test`, domain suite)
- [ ] integration tests pass. (`Planned (B0)`: database and API suites against a PostgreSQL service container)
- [ ] build passes. (`Planned (B0)`: `pnpm build`, ADR-006 point 11)
- [ ] E2E strategy configured. (`Deferred`: tools are chosen in the frontend-stage ADR and join the workflow once frontend code exists, ADR-006 point 11)

### Deployment
- [x] frontend target defined. (Defined: the static demo build under a subpath of the portfolio site, ADR-006 points 1 and 7; the publishing mechanism is `Deferred` to the frontend-stage ADR, ADR-010 point 6, §45)
- [x] backend target defined. (Defined: the local full stack, ADR-006 points 1 and 4; its container `Planned (B7)`)
- [x] database target defined. (Defined: local PostgreSQL in Compose; managed PostgreSQL `Deferred`, ADR-006 point 2, §30)
- [x] secrets strategy documented. (`Reference`: §13 and §78; no hosted secret store, ADR-006 point 2)
- [x] health checks available. (`Implemented`, §50; the API container healthcheck `Planned (B7)`, §51)
- [x] smoke tests defined. (Defined: one script after `docker compose --profile full up`, no frontend step, ADR-006 point 11, §49; the script itself `Planned (B7)`, and the flow of its check 5 is chosen in B7)

### Realtime
- [ ] endpoint configurable. (`Planned (B5)`: the server path is fixed, proposed `/ws` and confirmed in B5, with no `WEBSOCKET_PATH` variable (ADR-007 point 1); the client URL is the build-time `VITE_WS_URL`, proposed name (ADR-006 point 8), §72, §14)
- [ ] WSS supported publicly. (`Deferred`: no public backend, ADR-006 point 2)
- [ ] hosting requirements documented. (`Deferred` with hosting; the local requirements are §31)
- [ ] reconnect behavior preserved. (`Planned (FE)`: the client reconnect states, `08-realtime-spec.md`)

### Demo
- [ ] no paid infrastructure required. (`Planned (FE)`: a static build with no backend, ADR-006 point 7; NFR-067)
- [ ] infrastructure isolated. (`Planned (FE)`: no backend, no database and namespaced browser storage, §22-§24, §56)
- [ ] simulation follows `12-demo-mode-spec.md`. (Engine `Planned (B5)` (ADR-007 point 7); demo `Planned (FE)`; the demo specifics wait for the frontend-stage ADR, ADR-010 point 6)
- [ ] private infrastructure not exposed. (`Planned (FE)`: the build calls no backend and holds no secrets, ADR-006 point 7)

### Operations
- [ ] graceful shutdown works. (`Planned (B3)` for the server and the database; jobs `Planned (B4)`; realtime `Planned (B5)`, §16)
- [ ] startup failures are observable. (Partly: an invalid environment prints a message and exits with code 1 (`Implemented`); the structured startup entries `Planned (B3)`, ADR-009 point 11, §52)
- [x] deployment verification documented. (`Reference`: §48; the automated check `Planned (B7)`)
- [ ] troubleshooting documented. (Partly: §75; the developer workflow `Planned (B3)` and the `README.md` entries are pending (T5.2))

Code vs ADR:

- ADR-006 point 11 adds `pnpm format:check` as a CI check, and its additions of 2026-10-07 add `pnpm docs:check` (`Planned (B0)`, §41). The original CI list has neither.
- The list has no item for the runtime database role and the Postgres port binding (ADR-005 point 13, §6, §78), nor for the entries `app.shutdown.started` and `app.shutdown.completed` (ADR-006 point 12). They are tracked in those sections.
- "Frontend target defined" and "backend target defined" are decisions, so they are checked even though nothing is built. They stay as written because the original asked for targets, not for deployments.
- A hosted deployment would add items for hosting, TLS, secrets and a managed database; ADR-006 point 2 requires a new ADR first.

---

# 84. Deployment Tradeoffs

**Status:** `Reference`; the exclusions are ADR-006 and ADR-008 decisions

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

| Excluded | Why it holds in version 1 |
|---|---|
| Kubernetes, service meshes | One local API instance and no hosted backend (ADR-006 points 1 and 2, §67) |
| Terraform | Nothing is provisioned: no host, no managed database (ADR-006 point 2); infrastructure as code is `Deferred` (§93) |
| Distributed queues, dedicated worker fleets | Jobs run in the API process on a `jobs` table (ADR-008 point 4, §54) |
| Dedicated observability clusters | One JSON line per event on stdout, and metrics are `Deferred` (ADR-009 points 3 and 10, §53) |
| Multi-region deployment | No hosted backend (ADR-006 point 2) |
| Autoscaling infrastructure | One instance; several need a new ADR (§67) |

Code vs ADR:

- The list matches ADR-006, ADR-008 and ADR-009, and NFR-070 (avoid artificial complexity). No exclusion is stronger than a decision: each reopens only through a new ADR.
- The ADR also accepts costs, which this section should not hide: the full-stack experience exists only on the author's machine, and a broken build on `develop` becomes visible and must be fixed promptly (ADR-006, Consequences).

---

# 85. Free / Low-Cost Strategy

**Status:** `Reference`; version 1 has no recurring cost (NFR-052, NFR-067)

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

| Item | Version 1 |
|---|---|
| Architecture requirement | No paid service, no hosted backend and no managed database; the demo is a static build any free static host can serve (NFR-052, ADR-006 points 1 and 2) |
| Current provider choice | None. The demo sits under the author's portfolio site, which this project does not control and no ADR names (§28). Backend and database hosting are `Deferred` (§29, §30) |
| Limits to verify | Not applicable until a limited service is added; then it degrades instead of failing (NFR-068) |

Code vs ADR:

- "Local Docker as the canonical fallback" understates ADR-006. The local full stack is not a fallback for a hosted backend; it is the only backend target (ADR-006 points 1 and 2).
- The rule against claiming permanent free hosting stays. No decision may assume a paid plan, and none may assume a free one lasts (`04-tech-stack.md` §49).

---

# 86. Provider Selection Criteria

**Status:** `Reference`; frontend criteria `Planned (FE)`; backend and database criteria `Deferred` (ADR-006 point 2)

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

| Group | Applies to | Status |
|---|---|---|
| Frontend | The portfolio host of the demo, checked for HTTPS, static files and a SPA fallback under a subpath (ADR-006 point 7). Environment configuration is build-time only (`VITE_APP_MODE`) and holds no secret. Git deployment is not required: continuous deployment is excluded (ADR-006 point 10) | `Planned (FE)`; Git deployment `Deferred` |
| Backend | No provider is evaluated. The local full stack meets the list with Node.js, Docker Compose and PostgreSQL (§29) | `Deferred` |
| Database | No provider is evaluated. Local PostgreSQL 18 meets the list; backups are not applicable locally (ADR-006 point 9, §30) | `Deferred` |

Code vs ADR:

- ADR-006 names no provider, so this section names none. The criteria are the input to the ADR that hosting the backend would need.
- `Deferred` (frontend-stage ADR, ADR-010 point 6): confirming that the portfolio host serves HTTPS and a SPA fallback for the subpath (also §28) belongs to the demo hosting decision. Recommendation for that ADR: record the result there.

---

# 87. Vendor Independence

**Status:** `Reference`; per boundary below

Infrastructure integrations should be encapsulated.

The following must not require vendor-specific application logic unless isolated behind adapters:

- database
- realtime
- file storage
- observability
- external APIs

This preserves portability.

| Boundary | Version 1 | Status |
|---|---|---|
| Database | Repository interfaces in `@trading/domain` with Prisma implementations in `@trading/database`; in-memory implementations for the demo (ADR-001) | Interfaces and Prisma `Implemented`; in-memory `Planned (B0)` |
| Realtime | `ws` behind a transport port (ADR-007 point 1); the demo has an in-process adapter behind the same client port (point 13) | `Planned (B5)`; demo `Planned (FE)` |
| File storage | None. The CSV import content is stored in the `jobs` row (ADR-008 point 4), so no file store or adapter exists (§61) | Not applicable; a store `Deferred` |
| Observability | A `Logger` port with a `pino` adapter (ADR-009 point 1) | `Planned (B3)` |
| External APIs | None exists or is decided; market data is simulated (ADR-007 point 7, §62) | `Deferred` |

Code vs ADR:

- The database is the only boundary built today. PostgreSQL is a fixed choice (`04-tech-stack.md`); the encapsulation is of Prisma, not a promise of another database engine.
- The ports do not exist yet for the others. Until B0, B3 and B5, `apps/api` calls repositories directly and logs through `console` (§52). NFR-071 (evolution readiness) states the same rule: a new adapter and an ADR, not a domain rewrite.


---

# 88. Architecture Relationship

**Status:** `Reference`; the boundary rules `Planned (B0)` where a lint rule is decided

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

| Boundary | Version 1 | Status |
|---|---|---|
| Domain knows no environment | `@trading/domain` depends on nothing internal (`06-architecture.md` §44) and reads no environment variable | `Implemented` |
| Configuration enters at the edge | `apps/api/src/config/env.ts` validates the environment at startup; the composition root `apps/api/src/composition.ts` wires the repositories (ADR-001 point 4) | Env `Implemented`; composition root `Planned (B0)` |
| Application layer is environment-free | `@trading/application` imports no infrastructure; an import boundary rule enforces it (ADR-001 point 1, NFR-011) | `Planned (B0)` |
| Demo replaces adapters only | The same use cases run with in-memory repositories and a demo identity; no backend call, no secret (`06-architecture.md` §47, ADR-006 point 7) | `Planned (FE)` |
| Local, Docker, demo | Differ by configuration and composition, not by domain code: `APP_MODE` (`real` or `demo`, ADR-006 point 8) | `Planned (FE)`; the API does not read `APP_MODE` today |

Code vs ADR:

- The original diagram is a layering, not a dependency graph. The real direction points inward: `application` depends on `domain`, `database` on `domain`, and `api` on all three (`06-architecture.md` §44, ADR-001). Deployment is not a layer the code depends on; it only supplies configuration to the edge.
- `@trading/application` does not exist yet, so today `apps/api` services call repositories directly and the layers above `Domain` are not separated in code (`06-architecture.md` §4, §58).
- Docker-internal hostnames must not reach the browser configuration (§8); that is the same rule at the container boundary.

---

# 89. Observability Relationship

**Status:** per item (table below); `Reference` for the principle

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

| Capability | Version 1 | Status |
|---|---|---|
| Startup logs | A plain `console.log` line announces the port; the structured entries are `app.startup.started` and `app.startup.completed` (ADR-009 point 11, §52, `13-observability-spec.md` §8) | `Planned (B3)` |
| Request correlation | `X-Request-ID` is assigned or reused, echoed and present in error bodies (`apps/api/src/middleware/request-id.ts`); on every log line it is B3 (`13-observability-spec.md` §9) | Response `Implemented`; log lines `Planned (B3)` |
| Health | `GET /health` and `GET /health/ready` (§50, `13-observability-spec.md` §22-23); 503 with `status: "unavailable"` while shutting down (ADR-006 point 12) | `Implemented`; shutdown 503 `Planned (B3)` |
| Metrics | None, and no `/metrics` endpoint (ADR-009 point 10, `13-observability-spec.md` §16) | `Deferred` |
| Runtime errors | A generic 500 body, detail in the server log only (`apps/api/src/middleware/error-handler.ts`, `13-observability-spec.md` §12) | `Implemented`; the entry name `http.request.failed` `Planned (B3)` |
| Shutdown entries (not in the original list) | `app.shutdown.started` and `app.shutdown.completed`, mirroring the startup pair (ADR-006 point 12, ADR-009 point 11) | `Planned (B3)` |
| Verbosity | `LOG_LEVEL`, with `SLOW_REQUEST_THRESHOLD_MS` for slow requests (ADR-009 points 7 and 8, §10) | `Planned (B3)` |

Code vs ADR:

- "Observability is part of deployment readiness" holds for the items that exist. Metrics are not part of readiness in version 1, because ADR-009 point 10 defers them; hosting the backend would reopen that decision.
- The deployment view of the observability checklist is §80; the full definition of done and its split by block are `13-observability-spec.md` §74 (ADR-009 point 12). CI checks for observability are `13-observability-spec.md` §63.

---

# 90. Testing Relationship

**Status:** `Reference`; per stage below

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

| Stage | Version 1 | Status |
|---|---|---|
| Build | `pnpm build`; in CI to prove a clean checkout compiles (ADR-006 point 11) | Compile `Implemented`; in CI `Planned (B0)` |
| Test | `pnpm test`: the domain, database and API suites (§41, `10-testing-strategy.md` §53) | Local `Implemented`; in CI `Planned (B0)` |
| Package | The multi-stage, non-root API image (ADR-006 point 4); for the demo, the static build of `apps/web` | `Planned (B7)`; demo `Planned (FE)` |
| Run | `docker compose --profile full up`, with `node dist/index.js` in the container (ADR-006 points 3 and 4) | `Planned (B7)` |
| Health | `GET /health` and `GET /health/ready`; the container healthcheck (§50, §51) | Routes `Implemented`; healthcheck `Planned (B7)` |
| Smoke | The check of §49, run after the stack starts | `Planned (B7)` |

Code vs ADR:

- CI covers only the first two stages. The workflow publishes no artifact and runs no container (ADR-006 points 10 and 11), so Package, Run, Health and Smoke are run by hand on the author's machine from B7. That is the executable-system validation the original asks for; NFR-055 measures it.
- The stage order inside the CI workflow is not fixed by the ADR (§41); the order above is the logical order of the artifact's life.

---

# 91. Demo Relationship

**Status:** `Planned (FE)` (ADR-001 point 4, ADR-006 points 1 and 7); the demo data layers `Deferred` (ADR-010 point 6)

Demo deployment is a deployment target, not a separate product.

```text
Real:
API + PostgreSQL + WebSocket

Demo:
In-process use cases + in-memory repositories + browser storage + simulated realtime
```

Application behavior remains conceptually aligned.

| Concern | Real | Demo | Status |
|---|---|---|---|
| Application behavior | `@trading/application` use cases behind the API | The same use cases in the browser (ADR-001 point 4) | `Planned (B0)`; demo `Planned (FE)` |
| Persistence | PostgreSQL through Prisma | In-memory repositories with namespaced browser storage (ADR-006 point 7); the data layers and reset are not decided | `Planned (FE)`; layers `Deferred` |
| Realtime | WebSocket server (`ws`) | An in-process adapter fed by the same `@trading/market-sim` engine (ADR-007 point 13) | `Planned (B5)`; demo `Planned (FE)` |
| Identity | Login with a JWT (ADR-005) | A demo identity with a `Viewer`, `Trader` and `Admin` selector (ADR-005 point 11) | `Planned (FE)` |
| Infrastructure | Local `full` stack | A static build under a subpath, no backend, no secrets | `Planned (B7)`; demo `Planned (FE)` |

Code vs ADR:

- The original diagram listed a "Mock API". ADR-001 rejects a mock HTTP layer: the demo runs the real use cases in process (`06-architecture.md` §6.1). The diagram above follows that decision.
- The demo and the full stack are two targets (ADR-006 point 1) that share packages, not one artifact (§3). `12-demo-mode-spec.md` §93 leaves the deployment specifics of the demo build to this document, which are §22-§24, §28 and §56.

---

# 92. Technical Interview Demonstration

**Status:** per step (table below); `Reference` for the walkthrough as a whole

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

| Step | Version 1 counterpart | Status |
|---|---|---|
| 1. Start local services | `docker compose up -d` for PostgreSQL; the `full` profile adds the API | Default profile `Implemented`; `full` `Planned (B7)` |
| 2. Show frontend, backend and PostgreSQL | Backend and PostgreSQL run today; the frontend is the web app | Backend and database `Implemented`; frontend `Planned (FE)` |
| 3. Run or inspect migrations | `db:migrate`, `db:test:migrate` or `prisma migrate deploy`; run by the `migrate` service in the `full` profile (§18) | `Implemented`; the `migrate` service `Planned (B7)` |
| 4. Open health endpoint | `GET /health` and `GET /health/ready` (§50) | `Implemented` |
| 5. Demonstrate realtime | Server events and the client states and reconnect | `Planned (B5)` and `Planned (FE)` |
| 6. Trigger an observable operation | `X-Request-ID` on a response is `Implemented`; the log line with `requestId`, duration and result is B3 (`13-observability-spec.md` §65) | Mixed: `Implemented` and `Planned (B3)` |
| 7. Show production build | `pnpm build` compiles every package today; running `node dist/index.js` and the image are B7 | Compile `Implemented`; run `Planned (B7)` |
| 8. Explain how the architecture maps to public deployment | The only public deployment is the demo; the backend is never public (ADR-006 points 1 and 2). The mapping is the two targets of §95 and the adapters of §87 | `Reference` |
| 9. Demonstrate Demo Mode as an infrastructure substitution | The demo build next to the local full stack, on the same use cases; there is no runtime switch because `APP_MODE` is fixed at build time (`10-testing-strategy.md` §64) | `Planned (FE)` |

Code vs ADR:

- Step 8 changes: the original assumed a public deployment of the backend. ADR-006 point 2 removes it, so the explanation is why no hosted backend exists and what a new ADR would have to decide.
- The same demonstration is covered from the testing side in `10-testing-strategy.md` §64, from the observability side in `13-observability-spec.md` §65 and from the demo side in `12-demo-mode-spec.md` §89. The order here is a suggestion, not a requirement.

---

# 93. Future Evolution

**Status:** `Deferred`: no ADR adopts any item

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

| Capability | Where version 1 decides against it | Status |
|---|---|---|
| Dedicated worker | In-process runner (ADR-008 point 4, §54) | `Deferred` |
| Redis/pub-sub | Single API process, realtime behind a transport port (ADR-007 point 1, §68) | `Deferred` |
| Managed observability | Stdout JSON lines; metrics are `Deferred` (ADR-009 points 3 and 10, §53) | `Deferred` |
| Container registry | The image is built on the author's machine; CI pushes none (§44) | `Deferred` |
| Infrastructure as code | Nothing is provisioned (ADR-006 point 2, §84) | `Deferred` |
| Automated backups | Not applicable to a local environment (ADR-006 point 9, §73) | `Deferred` |
| Zero-downtime and blue/green deployments | One instance and forward-fix only (ADR-006 point 6, §46, §47) | `Deferred` |
| Horizontal API scaling | One local instance (§67) | `Deferred` |
| CDN optimization | Static build under the portfolio host (§69) | `Deferred` |
| Managed secrets | No hosted service; local `.env` files (§13) | `Deferred` |
| Distributed tracing | `13-observability-spec.md` §34-35 | `Deferred` |

Code vs ADR:

- Hosting the backend reopens most rows at once (ADR-006 point 2, ADR-009 point 10), so it is a single new ADR rather than twelve separate decisions.
- The ports that keep these options open are decided: repositories and the `Clock` (ADR-001), the transport port (ADR-007 point 1) and the `Logger` port (ADR-009 point 1). NFR-071 asks for exactly that, and no more.

---

# 94. Final Deployment Principle

**Status:** `Reference`

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

Code vs ADR:

- The chain is a set of environments, not a pipeline. CI validates and deploys nothing (ADR-006 point 10), and the demo and the production-like local stack are two separate targets (ADR-006 point 1), not consecutive stages.
- "Production-like environment" is the local `full` stack (`Planned (B7)`); no hosted production environment exists (ADR-006 point 2).
- The principle is the one enforced in §88 and §87: the domain reads no environment, and the ports isolate the infrastructure.

---

# 95. Final Deployment Model

**Status:** `Reference`; it restates ADR-006, which governs; each element carries its status in the table below

```text
                         Git Repository
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
     CI workflow         Local full stack        Public demo
     validation only     docker compose          static build of
     no deployment       --profile full          apps/web, APP_MODE=demo,
          │                    │                 under a subpath of
          │             ┌──────┴──────┐          the portfolio site
          │             │             │                 │
          │         PostgreSQL       API          in-process use cases,
          │        (default       node dist/      in-memory repositories,
          │         profile)      index.js        browser storage,
          │                       WebSocket       simulated realtime;
          │                                       no backend, no secrets
          ▼
   install · typecheck · lint · format · docs · build · tests
```

The model has exactly two deployment targets (ADR-006 point 1): the local full stack, run with Docker Compose on the author's machine, and the public demo. No backend is hosted: hosting, a managed database, a reverse proxy and public WSS are `Deferred`, and hosting the backend later requires a new ADR (ADR-006 point 2).

The deployment strategy demonstrates:

| Quality | How version 1 demonstrates it | Status |
|---|---|---|
| Reproducibility | A clean checkout installs from the lockfile and builds; the full stack starts with one command | CI `Planned (B0)`; stack `Planned (B7)` |
| Containerization | PostgreSQL in Compose today; a multi-stage, non-root API image in the `full` profile (ADR-006 point 4) | PostgreSQL `Implemented`; image `Planned (B7)` |
| Environment separation | `development`, `test` and local `production`, plus the demo build (ADR-006 point 8) | `Implemented` for the first two; `production` `Planned (B7)`; demo `Planned (FE)` |
| Database migrations | Prisma Migrate; `migrate deploy` in the one-shot `migrate` service; forward-fix only (ADR-006 points 5 and 6) | Migrations `Implemented`; the `migrate` service `Planned (B7)` |
| Secure configuration | Validated environment, secrets outside source control, no secret in the demo build (§12, §13, ADR-006 point 7) | `Implemented` for the API; demo `Planned (FE)` |
| CI | One workflow on pushes and pull requests to `develop` and `main`, also running `pnpm docs:check`, no continuous deployment (ADR-006 points 10 and 11) | `Planned (B0)` |
| Health checks | `GET /health`, `GET /health/ready`, the container healthcheck (§50, §51) | Routes `Implemented`; container `Planned (B7)` |
| Realtime deployment | A local `ws://` server in the API process, on the API's port and a fixed path (ADR-007 point 1); public WSS is `Deferred` (§31, §34) | `Planned (B5)`; public `Deferred` |
| Graceful shutdown | `SIGTERM` and `SIGINT`, a 10-second drain, readiness 503, exit code 1 if the drain expires and 0 otherwise (ADR-006 point 12, §16) | `Planned (B3)` |
| Production awareness | Forward-fix, no backups claimed, one instance, the explicit exclusions of §84 | `Reference` |
| Vendor independence | No provider, ports at the infrastructure boundaries (§87) | `Reference` |

without introducing infrastructure whose complexity is not justified by the project.

Code vs ADR:

- The original diagram had a "Production" target with "Real adapters", PostgreSQL, WebSocket and "external infra", fed by deployable artifacts from CI. ADR-006 removes all of it: there is no hosted target, CI publishes no artifact, and the two targets do not share one artifact (§3). The diagram above is the model of ADR-006 points 1-4 and 10.
- The local full stack and the demo are `Planned`: today only PostgreSQL in Compose, the API in development mode and the local checks exist. The model describes the end of B7 and the frontend stage, not the present.

---

# 96. Relationship to Other SDDs

**Status:** `Reference`

This document depends on and complements:

- `00-overview.md` — project scope and principles
- `01-product-spec.md` — product behavior
- `02-functional-requirements.md` — functional requirements
- `03-non-functional-requirements.md` — quality attributes (NFR-024 cites §78; NFR-051 to NFR-055 and NFR-067 cover health, cost, resources and reproducibility)
- `04-tech-stack.md` — technical stack
- `05-data-model.md` — the schema behind migrations, seed and reset (§17-§21 here)
- `06-architecture.md` — application architecture (§44 dependency direction, §58 deployment architecture)
- `07-api-spec.md` — API contracts (health routes, error bodies)
- `08-realtime-spec.md` — realtime architecture (§31 and §72 here)
- `09-security-spec.md` — security specification (the checklist of §78 here)
- `10-testing-strategy.md` — testing strategy (CI, §53; pull request gate, §54; environments, §56)
- `11-ui-ux-spec.md` — UX behavior
- `12-demo-mode-spec.md` — demo infrastructure (its §93 leaves the demo build to this document)
- `13-observability-spec.md` — logs, metrics, health and diagnostics (§8, §22-23, §38, §63)
- `15-implementation-plan.md` — the implementation phases; Phase 14 (§19) cites this document
- `16-analytics-spec.md` — analytics formulas; no deployment content, the code ships in the packages this document builds and tests
- `BACKEND-ROADMAP.md` — blocks B0-B7, which deliver the `Planned` items of this document
- `adr/0006-deployment-model-and-ci.md` — the decision that sets the scope of this document; `adr/0001-application-layer.md`, `adr/0005-roles-and-authentication.md`, `adr/0007-realtime-and-market-simulation.md`, `adr/0008-background-jobs-csv-import.md`, `adr/0009-observability-scope.md` and `adr/0010-v1-product-scope-clarifications.md` supply the other decisions cited here

Where this document and an ADR differ, the ADR wins (`README.md`, precedence).

`15-implementation-plan.md` is the next document: it orders the implementation into phases with dependencies, milestones and validation points, and cites this document in Phase 14 (§19).

Code vs ADR:

- The original text said `15-implementation-plan.md` "will translate" the SDD set. It exists, and its Phase 14 now marks HTTPS/WSS configuration and rollback documentation as removed, as ADR-006 points 2 and 6 decide; the alignment is done (T5.2).
- `05-data-model.md`, `15-implementation-plan.md`, `16-analytics-spec.md`, `BACKEND-ROADMAP.md` and the ADRs were missing from the original list.

---

# Document Status

**Status:** All sections reconciled with the code and ADRs on 2026-10-07

This document defines the deployment architecture for version 1 as decided in ADR-006: exactly two targets, the local full stack run with Docker Compose and the public demo as a static build, a minimal CI workflow, graceful shutdown, and forward-fix only; hosting, a managed database, a reverse proxy and public WSS are `Deferred`. Where it differs from an ADR, the ADR wins. Environment variable names follow `apps/api/src/config/env.ts` and ADR-006 point 8, and the shutdown sequence follows ADR-006 point 12. The deployment decisions approved on 2026-10-07 are applied in every section: `pnpm docs:check` in CI, test variables from the job `env`, the CI database roles, the single `.nvmrc`, `TZ=UTC` in the containers, the one-script smoke test, the readiness body, exit code and healthcheck, the startup entries, the jobs shutdown and stored-input rules, development rate limits, the pool default, the realtime hub interface, the WebSocket path, `maxPayload` and connection cap, and the build-time frontend variables. The open details listed per section (the CI stage order, the PostgreSQL image version in CI, the Postgres port binding, `DATABASE_URL` of a containerised API, whether a frontend container exists and the image details, `engines.pnpm`, the WebSocket `Origin` check, and the log levels of the lifecycle entries) are specified in the block that implements them (B0, B3, B4, B5, B7). The demo hosting, base path, SPA fallback and publishing mechanism are `Deferred` to the frontend-stage ADR (ADR-010 point 6). Hosting the backend requires a new ADR (ADR-006 point 2).
