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

- [x] T1 Query schema: preset periods and a custom `from`/`to` range (400 when `from > to`); `1D` comes from `MarketPrice`. Done in B1.3 as `analyticsPeriodQuerySchema`.
- [x] T2 Response schema and presenter: returns converted from `Decimal` only here.
- [x] T3 Service and `GET /portfolios/:id/analytics/performance`, with API tests. Split into T3a (shared `buildPortfolioSeries`, `performance-service.ts`) and T3b (controller, route, API tests).
- [x] T4 `performance` field in the overview response, with an integration test.
- [x] T5 Reconcile `07-api-spec.md` §11 and §20, `16-analytics-spec.md`, roadmap and PROGRESS.

## Done when

Integration tests for the endpoint and the overview field; a period that starts before the first data is clamped and states `effectiveFrom`; `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- T1 was already done in B1.3: the period query schema is shared by the risk and performance endpoints.
- A period that starts before the first purchase is not clamped to the purchase: days with nothing held are valued at `0` and count as priced, so `effectiveFrom` is the start of the window and those days appear in the series without a return. The clamp to `effectiveFrom` happens only when a held asset has no price (`16-analytics-spec.md` §5).
- `buildPortfolioSeries` (shared by risk and performance) and `buildPerformanceResult` (shared by the performance endpoint and the overview) came out of the refactor of `risk-service.ts`; the risk tests passed unchanged.
- The overview serves `performance` for the fixed period `1M`, identical to `GET .../analytics/performance?period=1M` (pinned by an API test).
- FR-085 in `02-functional-requirements.md` (table, `Planned (B1)`) is outside this block's edit surfaces; update its status in the docs pass at the end of B1.
