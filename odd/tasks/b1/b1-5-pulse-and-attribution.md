# B1.5 Real Pulse and attribution over a range

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`), rows 300, 303 and 304; ADR-004 point 11; ADR-010; `docs/07-api-spec.md` §21 and §22. Depends on: B1.3 and B1.4. Branch: `feat/b1-5-pulse-attribution`.

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

- [x] T1 Pulse thresholds: keep the constants, drop the placeholder comment, add boundary tests; volatility thresholds become annualized 20% and 60%.
- [x] T2 Pulse uses the portfolio volatility and drawdown instead of the largest-position proxy.
- [x] T3 The missing overview integration test for `dailyChange` and `pulse` values.
- [x] T4 Attribution over a range with `from`/`to` and `groupBy`: per-asset money contributions that sum to the period P/L. Split into T4a (pure `calculateRangeAttribution` and `groupContributions`), T4b (query schema, response schema, presenter), T4c (`range-attribution-service.ts`, route and API tests). The ADR-010 tie and open/close rules moved to B1.6.
- [x] T5 Reconcile `07-api-spec.md` §21 and §22, `16-analytics-spec.md` §14 and §15, roadmap and PROGRESS.

## Done when

Boundary tests for each Pulse threshold; the overview integration test asserts concrete `dailyChange` and `pulse` values; the range attribution is covered by API tests; `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- The T4 line mixed in two ADR-010 rules (ties go to the alphabetically first symbol; a position that opens and closes reports both events in date order). They belong to the What Changed read model (largest contributor and detractor, events), so they moved to B1.6. `16-analytics-spec.md` §14 defines the range attribution as money-only contributions per `asset` or `assetType`.
- `GET .../analytics/attribution` keeps its current-state shape when the query has no `period`, `from`, `to` or `groupBy`; with any of them it serves the range shape. Decided with the user.
- The attribution query is now validated: an invalid query (for example `?groupBy=bogus&from=garbage`) is 400 `VALIDATION_ERROR` instead of being ignored. The old test that pinned the ignoring was replaced by two tests.
- `buildPortfolioSeries` now returns `inputs` (timeline, candles, transactions) for the measures that split the series by asset. Risk, performance and overview ignore it.
- The contributions are measured over the same clamped run as the portfolio P/L, so the sum equals the period P/L exactly in `Money` (asserted in the domain test). Groups are ordered by key only for determinism.
- `16-analytics-spec.md` was added to the edit surfaces for T5.
- FR-085 in `02-functional-requirements.md` stays for the docs pass at the end of B1.
