# B1.7 Realized P/L in the API and the single-currency rule

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`, deferred detail), ADR-003 point 4; ADR-004 points 12 and 15; FR-012. Depends on: B1.1 and B1.6. Branch: `feat/b1-7-realized-pnl-currency`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
apps/api/src/**
docs/05-data-model.md
docs/07-api-spec.md
docs/16-analytics-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Specs

- S1 "A transaction on an asset whose currency differs from the portfolio's base currency is rejected with 400." (ADR-004 point 12)
- S2 Every transaction response carries `realizedPnL`: the P/L a `SELL` realized, after fees, against the average cost at its place in date order; `null` for a `BUY`. (ADR-003 point 4, ADR-004 point 15)

## Tasks

- [x] T1 Single-currency rule in `createTransaction` (S1), with service and API tests.
- [x] T2a `replayRealizedPnL` identifies the transaction behind each sale.
- [x] T2b `realizedPnL` in the transaction response and in the overview's recent transactions.
- [x] T2c `buildRealizedByTransaction`, the service (list, detail, create) and the controller, with an API test.
- [x] T3 Reconcile `05-data-model.md`, `07-api-spec.md`, `16-analytics-spec.md`, roadmap and PROGRESS.

## Done when

An asset in another currency is a 400 that writes nothing; every transaction response carries `realizedPnL`, and a BUY dated in the past moves the P/L of the later SELLs; the docs agree.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- The audit of B1 found two items still open after B1.6: the realized P/L was only a pure function, and the single-currency rule of ADR-004 point 12 was not enforced. The user chose to build them as B1.7 before closing B1.
- The realized P/L is calculated when it is read, not stored: transactions are inserted in date order, so a backdated BUY changes the average cost at every later SELL and a stored value would go stale. This also avoids a migration.
- The list and detail replay the whole completed history of the portfolio, not only the page, because the cost at a sale depends on every earlier BUY.
- The currency check compares the asset with the portfolio. The currency of `price` and `fees` is not compared with it; the spec says so.
- `ReplayEntry` gained an optional `id`, and `RealizedSale` an optional `transactionId`, so the sales can be joined to their transactions. Existing callers are unaffected.
- The `15-implementation-plan.md` rows for these two items are left for the docs pass that closes B1.
