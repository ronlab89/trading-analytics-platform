# B1.1 Fees in cost basis and realized P/L

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`), deferred-detail rows 295 and 299; ADR-004 point 15; `docs/16-analytics-spec.md`. Depends on: B0. Branch: `feat/b1-1-fees`. First block of B1 because it changes numbers that already exist.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
packages/database/src/**
packages/persistence-memory/src/**
apps/api/src/**/*.test.ts
docs/07-api-spec.md
docs/05-data-model.md
docs/16-analytics-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Tasks

- [x] T1 Reject a `SELL` whose fees exceed its gross proceeds (`fees > quantity × price`) with 400; fees equal to the gross proceeds are accepted. Domain rule plus API test; nothing existing changes.
- [x] T2 `BUY` fees enter `averageEntryPrice` in the date-order replay (`ReplayEntry` gains `fees`). Existing expectations of `averageEntryPrice` and unrealized P/L shift and are updated.
- [x] T3 Realized P/L from the replay: `SELL` fees reduce it. New pure function, hand-computed tests.
- [x] T4 Reconcile `07-api-spec.md`, `05-data-model.md` and `16-analytics-spec.md` with T1 to T3.

## Done when

A `SELL` with fees above the gross proceeds returns 400; `averageEntryPrice` includes `BUY` fees; realized P/L exists and subtracts `SELL` fees; every changed expectation is explained in the log.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/database test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- T2 changed no existing expectation: the existing tests use zero fees, so their `averageEntryPrice` is unchanged.
- T2 and T3 put the cost math in `position-replay.ts` (`applyBuy`, `assertCanSell`, `applySell`, `sortByExecutedAt`), shared by `replayPosition` and `replayRealizedPnL`. The spec named `position-recalculation.ts`, but `calculatePositionAfterTransaction` has no caller left.
- Follow-up (cleanup, not B1.1): `position-recalculation.ts` keeps only `InsufficientPositionQuantityError` in use; `calculatePositionAfterTransaction` is dead code. `docs/15-implementation-plan.md` (lines 694, 715) and `docs/06-architecture.md` (lines 536, 798) still described it, and line 715 wrongly said fees are ignored. Outside this task's edit surfaces; aligned in the B1.2 PR. The dead code itself is still pending.
- Follow-up: the seed (`packages/database/src/seed/data/positions-and-transactions.ts`) has fixed `averageEntryPrice` values and `BUY`s with fees, so seeded positions differ slightly from what a replay would give. Decide whether to align them.
- Realized P/L is a pure function only: persistence and API exposure belong to the next B1 slices.
