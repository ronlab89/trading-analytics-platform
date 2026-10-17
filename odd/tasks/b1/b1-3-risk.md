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

- [x] T1 Volatility over a return series: annualized with the square root of 365, at least 20 returns, `Decimal`. The asset-level callers are adapted.
- [x] T2 Drawdown on the cumulative return index, with the current drawdown as well as the maximum.
- [x] T3 Response schema and presenter for the risk metrics (`null` plus `status`, never `0`).
- [x] T4 Service and `GET /portfolios/:id/analytics/risk`, with query validation and API tests. Split into T4a (period query schema), T4b (`risk-service.ts`) and T4c (controller, route, API tests).
- [x] T5 Reconcile `07-api-spec.md` §20 (Risk) and `16-analytics-spec.md` §8-§10, roadmap and PROGRESS.

## Done when

Hand-computed tests for volatility and drawdown; the endpoint returns `null` for volatility under 20 returns and `INSUFFICIENT_DATA` when there is no closed day or price; `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Done-when wording changed from "INSUFFICIENT_DATA under 20 returns" to the approved rule: the global `status` is `INSUFFICIENT_DATA` without a price on `asOf` or a closed day, `UNKNOWN` when neither measure has a value, `OK` otherwise; under 20 returns only `volatilityPercent` is `null`.
- `calculateVolatility` (asset-level) now annualizes with √365 and needs 21 prices. Portfolio Pulse reads it, so its volatility values and the 20%/60% thresholds (ADR-004) should be re-checked when Pulse takes the portfolio series.
- Choices not in the spec: `to` without `from` is 400; with no decline the peak and trough dates are `null`; the last closed day is the UTC day before `clock.now()`.
- `risk-service.ts` is separate from `analytics-service.ts`; extract the shared series pipeline when B1.4 adds performance.
- `Decimal` is re-exported from `@trading/domain` so `contracts` tests can build values without a new dependency.
