# B1.4 Performance endpoint and overview field

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`); ADR-004 points 2 to 6; FR-025 and FR-026 (P0); `docs/07-api-spec.md` §20. Depends on: B1.2. Branch: `feat/b1-4-performance-api`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/application/src/**
packages/contracts/src/**
apps/api/src/**
docs/07-api-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Tasks

- [ ] T1 Query schema: preset periods and a custom `from`/`to` range (400 when `from > to`); `1D` comes from `MarketPrice`.
- [ ] T2 Response schema and presenter: returns converted from `Decimal` only here.
- [ ] T3 Service and `GET /portfolios/:id/analytics/performance`, with API tests.
- [ ] T4 `performance` field in the overview response, with an integration test.
- [ ] T5 Reconcile `07-api-spec.md` §20.

## Done when

Integration tests for the endpoint and the overview field; a period that starts before the first data is clamped and states `effectiveFrom`; `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.
