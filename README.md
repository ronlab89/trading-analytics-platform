# Trading Analytics Platform

Portfolio engineering project: a trading analytics workspace built as both (1) a full-stack
application and (2) a fully functional public demo running on mocked infrastructure.

The full specification lives in [`docs/`](./docs): the SDD documents `00` to `15`, the analytics
specification (`16-analytics-spec.md`) and the architecture decision records in
[`docs/adr/`](./docs/adr/README.md).

## Status

Work in progress; development is backend-first. The repository holds:

- `packages/domain`: framework-agnostic domain logic.
- `packages/database`: Prisma schema (16 models), repositories and the seed workflow.
- `apps/api`: an Express REST API with 15 routers mounted (health, auth login and `me`,
  portfolios, positions, transactions, decisions, scenarios, assets, market, analytics,
  overview, watchlist, alerts, notifications, preferences).

Not built yet: token refresh and logout, the application layer and shared contracts, background
jobs, realtime, CI and the web app (`apps/web` holds only a wireframe). The remaining backend
work is planned as blocks B0 to B7, followed by the frontend stage; the order and the
phase-to-block mapping are in
[`docs/15-implementation-plan.md`](./docs/15-implementation-plan.md) section 4.1.
[`docs/PROGRESS.md`](./docs/PROGRESS.md) is a working log that is being updated.

## Requirements

- Node.js >= 22
- pnpm >= 9 (via corepack)

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

Check that it is up: `GET /health` (liveness) and `GET /health/ready` (readiness, answers 503
when PostgreSQL is not reachable). Environment notes and troubleshooting are in
[`CONTRIBUTING.md`](./CONTRIBUTING.md) sections 9 and 10.

## Local Database

PostgreSQL runs via Docker Compose. Two levels of reset are available,
depending on what's actually broken:

### Light reset — data only

Restores the seeded baseline dataset (1 demo user, 3 portfolios, 7 assets,
positions/transactions with realistic gain/loss/flat variety, decisions,
scenarios, alerts, notifications, and 30 days of historical OHLCV prices
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
  web/        # Frontend: only a wireframe so far; the app is not started
  api/        # Node/Express REST API (foundation implemented)
packages/
  domain/     # Framework-agnostic domain logic (entities, validation, calculations)
  database/   # Prisma schema, repositories, seed workflow
  contracts/  # Placeholder (.gitkeep); planned for B0
  config/     # Placeholder (.gitkeep)
docs/         # SDD specification, ADRs and working documents
docker/       # Placeholder (.gitkeep); PostgreSQL runs from docker-compose.yml
```

## Documentation

See [`docs/README.md`](./docs/README.md) for the document map and precedence rules,
`docs/00-overview.md` for the project overview and `docs/15-implementation-plan.md`
for the implementation plan. Decisions are recorded in [`docs/adr/`](./docs/adr/README.md).

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the branching model, commit conventions,
and pull request workflow used in this repository.
