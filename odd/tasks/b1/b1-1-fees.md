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
- [ ] T4 Reconcile `07-api-spec.md`, `05-data-model.md` and `16-analytics-spec.md` with T1 to T3.

## Done when

A `SELL` with fees above the gross proceeds returns 400; `averageEntryPrice` includes `BUY` fees; realized P/L exists and subtracts `SELL` fees; every changed expectation is explained in the log.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/database test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.
