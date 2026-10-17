# B1.5 Real Pulse and attribution over a range

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`), rows 300, 303 and 304; ADR-004 point 11; ADR-010; `docs/07-api-spec.md` §21 and §22. Depends on: B1.3 and B1.4. Branch: `feat/b1-5-pulse-attribution`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
apps/api/src/**
docs/07-api-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Tasks

- [ ] T1 Pulse thresholds: keep the constants, drop the placeholder comment, add boundary tests; volatility thresholds become annualized 20% and 60%.
- [ ] T2 Pulse uses the portfolio volatility and drawdown instead of the largest-position proxy.
- [ ] T3 The missing overview integration test for `dailyChange` and `pulse` values.
- [ ] T4 Attribution over a range with `from`/`to`: query validation, realized and unrealized contributions, ties go to the alphabetically first symbol, a position that opens and closes in the period reports both events in date order.
- [ ] T5 Reconcile `07-api-spec.md` §21 and §22.

## Done when

Boundary tests for each Pulse threshold; the overview integration test asserts concrete `dailyChange` and `pulse` values; the range attribution is covered by API tests; `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.
