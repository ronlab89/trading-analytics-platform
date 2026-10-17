# B1.3 Portfolio risk: volatility and drawdown

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`), row 301; ADR-004 points 8 to 10; `docs/16-analytics-spec.md`; `docs/07-api-spec.md` §21. Depends on: B1.2. Branch: `feat/b1-3-risk`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
apps/api/src/**
docs/07-api-spec.md
docs/16-analytics-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Tasks

- [ ] T1 Volatility over a return series: annualized with the square root of 365, at least 20 returns, `Decimal`. The asset-level callers are adapted.
- [ ] T2 Drawdown on the cumulative return index, with the current drawdown as well as the maximum.
- [ ] T3 Response schema and presenter for the risk metrics (`null` plus `status`, never `0`).
- [ ] T4 Service and `GET /portfolios/:id/analytics/risk`, with query validation and API tests.
- [ ] T5 Reconcile `07-api-spec.md` §21.

## Done when

Hand-computed tests for volatility and drawdown; the endpoint returns `INSUFFICIENT_DATA` under 20 returns; `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.
