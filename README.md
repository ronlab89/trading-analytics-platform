# Trading Analytics Platform

Portfolio engineering project: a trading analytics workspace built as both (1) a full-stack
application and (2) a fully functional public demo running on mocked infrastructure.

Full specification lives in [`docs/`](./docs) (SDD 00 through 15).

## Status

🚧 Phase 0 — Repository Foundation. No application code yet.

## Requirements

- Node.js >= 22
- pnpm >= 9 (via corepack)

## Setup

```bash
pnpm install
pnpm typecheck
```

## Structure

```text
apps/
  web/        # React frontend (Vite)
  api/        # Node/Express backend
packages/
  contracts/  # Shared API/domain contracts (Zod schemas, types)
  domain/     # Framework-agnostic domain logic
  config/     # Shared config/env validation
docs/         # SDD specification documents
docker/       # Local infrastructure (PostgreSQL, etc.)
```

## Documentation

See `docs/00-overview.md` for the full project overview and `docs/15-implementation-plan.md`
for the implementation roadmap.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the branching model, commit conventions,
and pull request workflow used in this repository.