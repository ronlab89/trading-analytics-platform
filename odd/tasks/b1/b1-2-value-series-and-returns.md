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
- [x] T2 One pure function maps a preset period (`1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL`) and `to` to `from`, with month-end, leap-year and `YTD` tests. Day boundaries are UTC calendar dates.
- [x] T3 Daily quantity timeline per asset from the transactions (date-order replay).
- [x] T4 Daily portfolio value series: the last close is carried forward; an asset that never had a price is `InsufficientData`. Hand-computed tests.
- [x] T5 Time-weighted return and absolute P/L over a period (`BUY` as inflow, `SELL` as outflow; boundaries `V(day before from)` and flows over `[from, to]`; clamped periods state `effectiveFrom`). `Decimal` throughout. Split in two commits:
  - [x] T5a Daily flows `B(d)`/`S(d)` and the daily return `r(d)` (`daily-return.ts`), hand-computed tests of §4 and §6.
  - [x] T5b Period performance (`period-performance.ts`): `TWR` and `P/L` with the §5 clamp and `effectiveFrom`; status `OK` or `INSUFFICIENT_DATA` (`UNKNOWN` is not produced here); the daily returns of the counted days.
- [x] T6 Reconcile `16-analytics-spec.md` (§3 to §8 `Planned (B1)` to `Implemented` as pure functions), the roadmap and `PROGRESS.md` with T1 to T5.

## Done when

Hand-computed unit tests for the series and each metric; unavailable values are `null` with a `status` of `OK`, `INSUFFICIENT_DATA` or `UNKNOWN`, never `0`; nothing is exposed through the API yet.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/persistence-memory test; pnpm --filter @trading/database test; pnpm typecheck; pnpm lint.

## Log

- T1: candles that share a `timestamp` are in no guaranteed order across assets (JS and Postgres collations differ); T4 must not depend on it.
- T2: `resolvePeriodWindow` returns `null` for `ALL` without transactions; T5 maps it to the no-data status. It does not clamp to `effectiveFrom`.
- T3: `buildQuantityTimeline` sums with `Decimal` so quantities that cancel out reach exactly `0`. The UTC day helpers moved to the internal `calculations/utc-date.ts`, shared with `period.ts`. Flows `B(d)`/`S(d)` are not part of T3; T5 needs them.
- T4: `buildValueSeries` marks a day `INSUFFICIENT_DATA` with `value: null` when a held asset has no candle on or before it; it does not compute `effectiveFrom` (T5). Requirement for the caller (B1.4 service): read candles from before the first day of the range, or the carry-forward prices the first days wrongly as insufficient data.
- T5a: returns are `Decimal` fractions (`0.1` is +10%); percentage points are the presenter's job (ADR-004). `calculateDailyReturn` returns `null`, not `0`, when `V(d-1) + B(d)` is zero.
- T5b: `calculatePeriodPerformance` takes `values` and `flows` aligned by index, `values[0]` being the baseline day `V(from - 1)`; the clamp is the trailing run of priced days ending on `to`. An empty series is an empty portfolio (`OK`, zero P/L, no TWR). Status `UNKNOWN` is not produced; it stays for the volatility and drawdown minimums (B1.3).
- Follow-up for B1.4 (service): build the days from `resolvePeriodWindow`, read transactions with `listCompletedByPortfolioId` and candles with `listByAssetIds` from before the first day, then `buildQuantityTimeline`, `buildValueSeries`, `buildDailyFlows` and `calculatePeriodPerformance`. `to` must also be clamped to the last closed day (`asOf`, spec §8).
- Follow-up (B0 debt, not B1.2): `replayPosition` subtracts quantities with `number`, so `0.3 - 0.1 - 0.2` leaves a residual instead of closing the position.
- Reconcile at the end of B1.2: `16-analytics-spec.md` §3 and §8 are still marked `Planned (B1)`.
