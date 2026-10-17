# B1.2 Portfolio value series and returns

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`), rows 296 to 298 and 302; ADR-004 points 1 to 7; `docs/16-analytics-spec.md`. Depends on: B1.1. Branch: `feat/b1-2-value-series`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/database/src/**
packages/persistence-memory/src/**
packages/contracts/src/**
apps/api/src/**/*.test.ts
docs/16-analytics-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Tasks

- [x] T1 Ports: an unpaginated, oldest-first, `COMPLETED`-only transaction read by portfolio, and a batch candle read by several assets and a date range. Added to both repositories and to both contract suites.
- [ ] T2 One pure function maps a preset period (`1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL`) and `to` to `from`, with month-end, leap-year and `YTD` tests. Day boundaries are UTC calendar dates.
- [ ] T3 Daily quantity timeline per asset from the transactions (date-order replay).
- [ ] T4 Daily portfolio value series: the last close is carried forward; an asset that never had a price is `InsufficientData`. Hand-computed tests.
- [ ] T5 Time-weighted return and absolute P/L over a period (`BUY` as inflow, `SELL` as outflow; boundaries `V(day before from)` and flows over `[from, to]`; clamped periods state `effectiveFrom`). `Decimal` throughout.

## Done when

Hand-computed unit tests for the series and each metric; unavailable values are `null` with a `status` of `OK`, `INSUFFICIENT_DATA` or `UNKNOWN`, never `0`; nothing is exposed through the API yet.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/persistence-memory test; pnpm --filter @trading/database test; pnpm typecheck; pnpm lint.
