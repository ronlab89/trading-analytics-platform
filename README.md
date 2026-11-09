# Trading Analytics Platform

Portfolio engineering project: a trading analytics workspace built as both (1) a full-stack
application and (2) a fully functional public demo running on mocked infrastructure.

The full specification lives in [`docs/`](./docs): the SDD documents `00` to `15`, the analytics
specification (`16-analytics-spec.md`) and the architecture decision records in
[`docs/adr/`](./docs/adr/README.md).

## Status

Work in progress: the backend is done and the frontend stage is nearly done. The repository holds:

- `packages/domain`: framework-agnostic domain logic.
- `packages/database`: Prisma schema (16 models), repositories and the seed workflow.
- `apps/web`: the React web app, in real mode (against the API) and in demo mode (no API).
- `apps/api`: an Express REST API with 15 routers mounted (health, auth login and `me`,
  portfolios, positions, transactions, decisions, scenarios, assets, market, analytics,
  overview, watchlist, alerts, notifications, preferences).

The backend is done (blocks B0 to B7): auth with refresh and logout, the application layer and
shared contracts, analytics, background jobs, realtime, OpenAPI, CI, and a production image with
a `full` Compose profile and a smoke test. The web app (`apps/web`, Vite and React 19) has its
screens, the realtime client and the static public demo (blocks FE0 to FE4); the accessibility
and performance refinement (FE5) and the portfolio case study (FE6) are planned. The order and the
phase-to-block mapping are in
[`docs/15-implementation-plan.md`](./docs/15-implementation-plan.md) section 4.1.
[`docs/PROGRESS.md`](./docs/PROGRESS.md) is a working log that is being updated.

## Requirements

- Node.js >= 24 (`.nvmrc`)
- pnpm 12 (via corepack; `packageManager` in `package.json` pins the version)

## Setup

```bash
pnpm install
pnpm typecheck
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) section 9 for the full list of quality commands.

## Run the API

```bash
cp .env.example .env          # then edit it; JWT_SECRET needs at least 32 characters
docker compose up -d          # PostgreSQL
pnpm --filter @trading/database db:generate
pnpm --filter @trading/database db:migrate
pnpm --filter @trading/database db:seed       # optional, see Local Database below
pnpm --filter @trading/api dev                # PORT defaults to 7001
```

The API documentation is at `http://localhost:7001/api/docs` (Scalar) and the OpenAPI document at `/openapi.json`; both are off in production unless `API_DOCS_ENABLED=true`.

Check that it is up: `GET /health` (liveness) and `GET /health/ready` (readiness, answers 503
when PostgreSQL is not reachable). Environment notes and troubleshooting are in
[`CONTRIBUTING.md`](./CONTRIBUTING.md) sections 9 and 10.

Container image of the API: `docker build -f apps/api/Dockerfile -t trading-api .` (workspace root as context).

The whole stack in containers (PostgreSQL, migrations, API and the web app), with `JWT_SECRET` set in
`.env` or in the shell (at least 32 characters):

```bash
docker compose --profile full up -d --build   # web on http://localhost:5173, API on :7001
docker compose run --rm seed                  # demo data; wipes and reloads, run it once
```

Sign in with `demo@trading-analytics.dev` / `demo1234` (the seeded user). The web image bakes the API
addresses in at build time; if you change `API_PORT`, rebuild with `--build`. Stop it with
`docker compose --profile full down` (add `-v` to drop the database).

The default `docker compose up -d` still starts PostgreSQL alone. The seed is never run for you.

Smoke test of that stack (readiness, login with the seeded user, a read of the seeded portfolios):

```bash
pnpm --filter @trading/database db:seed
pnpm smoke
```

## Run the web app

With the API running (see above):

```bash
pnpm --filter @trading/web dev        # http://localhost:5173
```

It talks to the API at `VITE_API_BASE_URL` and to its WebSocket at `VITE_WS_URL`; both have local
defaults. See [`apps/web/README.md`](./apps/web/README.md) for its scripts and structure and
[`apps/api/README.md`](./apps/api/README.md) for the API's.

## Public demo

The web app also builds as a static demo that needs no API and no database
([ADR-012](./docs/adr/0012-demo-build-specifics.md)). The browser runs the real application
services over in-memory repositories, with seeded portfolios, transactions, alerts and a
watchlist, and a simulated market that ticks prices and fires the seeded alerts. Nothing leaves
the browser, and a reload brings it back to its seed.

```bash
pnpm --filter @trading/web dev:demo    # dev server in demo mode
pnpm --filter @trading/web build:demo  # static build in apps/web/dist
```

In the demo, the login screen is drawn in full but its email, password and "Sign in" are disabled:
a visitor picks a role (viewer, trader or admin) and presses "Enter the demo". The
"Demo data" menu of the top bar can simulate a connection problem (the status bar goes through
reconnecting and back to live), send a test notification, and reset the demo.

- **Bundles.** `pnpm --filter @trading/web check:bundles` builds the app in both modes and checks
  that the demo bundle has no HTTP adapter or API address and the real bundle has no demo code.
- **Smoke.** `pnpm --filter @trading/web test:e2e:demo` builds the demo and runs a Playwright
  smoke against it. CI runs both checks.
- **Publishing.** [`netlify.toml`](./netlify.toml) builds the demo, publishes `apps/web/dist` and
  rewrites every path to `index.html`.

## Local Database

PostgreSQL runs via Docker Compose. Two levels of reset are available,
depending on what's actually broken:

### Light reset — data only

Restores the seeded baseline dataset (1 demo user, 3 portfolios, 7 assets,
positions/transactions with realistic gain/loss/flat variety, decisions,
scenarios, alerts, notifications, and 90 days of historical OHLCV prices
per asset). Safe to run anytime; the schema is untouched.

```bash
docker compose up -d
pnpm --filter @trading/database db:seed
```

### Hard reset — schema + data

Drops and recreates the database, reapplies every migration from scratch,
then automatically reseeds. Use this when migrations or the schema itself
are in a broken/inconsistent state, not just the data.

```bash
docker compose up -d
pnpm --filter @trading/database db:reset
```

This prompts for confirmation before dropping the database — it's a
destructive operation by design.

### Inspecting data

```bash
pnpm --filter @trading/database db:studio
```

## Structure

```text
apps/
  web/                  # Frontend: Vite and React 19 app, real and demo builds
  api/                  # Node/Express REST API
packages/
  domain/               # Framework-agnostic domain logic (entities, validation, calculations)
  application/          # Use cases and ports (repositories, clock, logger, jobs)
  contracts/            # Shared request/response contracts and OpenAPI source
  database/             # Prisma schema, repositories, seed workflow
  persistence-memory/   # In-memory repositories, used by the demo and by the contract tests
  market-sim/           # Simulated market (prices and ticks) for the demo
  config/               # Placeholder (.gitkeep)
docs/                   # SDD specification, ADRs and working documents
docker/                 # Placeholder (.gitkeep); PostgreSQL runs from docker-compose.yml
```

## Documentation

See [`docs/README.md`](./docs/README.md) for the document map and precedence rules,
`docs/00-overview.md` for the project overview and `docs/15-implementation-plan.md`
for the implementation plan. Decisions are recorded in [`docs/adr/`](./docs/adr/README.md).

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the branching model, commit conventions,
and pull request workflow used in this repository.
