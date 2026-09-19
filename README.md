# Trading Analytics Platform

Portfolio engineering project: a trading analytics workspace built as both (1) a full-stack
application and (2) a fully functional public demo running on mocked infrastructure.

Full specification lives in [`docs/`](./docs) (SDD 00 through 15).

## Status

🚧 Phase 2 — Database and Infrastructure: complete. PostgreSQL + Prisma repositories for
all 15 domain entities, plus a full seed workflow (`packages/database`). Backend API
(Phase 3) not started yet.

## Requirements

- Node.js >= 22
- pnpm >= 9 (via corepack)

## Setup

```bash
pnpm install
pnpm typecheck
```

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
  web/        # React frontend (Vite) — not started yet
  api/        # Node/Express backend — not started yet
packages/
  domain/     # Framework-agnostic domain logic (entities, validation, calculations)
  database/   # Prisma schema, repositories, seed workflow
docs/         # SDD specification documents
docker/       # Local infrastructure (PostgreSQL, etc.)
```

## Documentation

See `docs/00-overview.md` for the full project overview and `docs/15-implementation-plan.md`
for the implementation roadmap.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the branching model, commit conventions,
and pull request workflow used in this repository.
