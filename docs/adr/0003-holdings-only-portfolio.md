# ADR-003: Holdings-Only Portfolio with BUY and SELL Transactions

**Status:** Accepted
**Date:** 2026-10-04
**Amended:** 2026-10-07 (point 7, immutability, approved by the user from the
`15-implementation-plan.md` reconciliation)
**Implemented in:** points 1 to 5 already match the code; point 6 in roadmap
block B0 (not yet implemented)

## Context

The SDD disagrees with itself about cash and transaction types:

| Source | Statement |
|---|---|
| `00-overview.md` §5.2 | Deposits and withdrawals are explicitly out of scope |
| `01-product-spec.md` §8 | Types "may include" Buy, Sell, Deposit, Withdrawal, Fee, Adjustment |
| `05-data-model.md` §9 | `BUY` and `SELL`; other types only "when the business model requires them" |
| `05-data-model.md` §24 | Portfolio metrics list a `cashValue` field |
| `07-api-spec.md` §39 | Deposits and withdrawals listed as idempotency candidates |
| `12-demo-mode-spec.md` §47 | "Insufficient simulated cash" as a validation error |

The code implements `BUY` and `SELL` only (`TransactionType` in
`schema.prisma`), with fees as the `fees` field of a transaction, and has no
cash balance.

The decision matters beyond wording: portfolio performance (ADR-004) depends
on whether buying increases portfolio value or converts cash into holdings.

## Decision

1. **Transaction types.** Version 1 supports `BUY` and `SELL` only. Fees are
   the `fees` field of a transaction, not a separate type.
2. **No cash balance.** A portfolio is a set of holdings. It has no cash
   balance, no `cashValue` metric and no "insufficient cash" validation. The
   equivalent validation is the existing `InsufficientPositionQuantityError`
   on overselling.
3. **Cash flows for performance.** For return calculations, every `BUY` is
   an external inflow into the portfolio and every `SELL` is an external
   outflow, so buying more is never reported as a gain. The formula is
   defined in ADR-004.
4. **Realized P/L.** Realized profit and loss is calculated and reported.
   Sale proceeds leave the portfolio; they are not retained as cash.
5. **Future types.** `DEPOSIT`, `WITHDRAWAL`, `DIVIDEND` and `FEE` are
   `Deferred`. They may only be introduced together with a complete cash
   ledger (balance, cash-consuming buys, cash in portfolio value), decided
   in a new ADR that supersedes this one.
6. **Chronological validation.** A transaction is accepted only if the
   holding of that asset stays non-negative at its `executedAt` and after
   every later transaction in date order. Backdating is allowed, because
   CSV import is historical by definition. CSV import rows (ADR-008) go
   through the same rule.
   *Decision corrected on 2026-10-04 after a systematic audit (point 6
   added):* `executedAt` may be in the past, but the oversell check used only
   the current position. A `SELL` dated before an earlier `BUY` passed and
   left historical holdings negative, which breaks ADR-004.
7. **Immutability** (added 2026-10-07, approved by the user). A transaction
   cannot be edited or deleted in version 1. After creation only its `status`
   changes (`05-data-model.md` §43, `07-api-spec.md` §13), and there is no
   edit, delete or cancel endpoint.

## Consequences

**Positive**

- Consistent with `00-overview.md`: the product is analytics, not a
  brokerage.
- No migration; points 1 to 5 already match the implementation.
- Performance stays honest without a cash model, through the cash-flow rule
  in point 3.

**Negative**

- Portfolio value excludes cash, so it is not a full account balance.
- The demo loses an "insufficient cash" failure case; overselling remains
  the representative validation failure.
- The current implementation checks only the current position
  (`apps/api/src/services/transaction.service.ts`) and must change to
  replay the asset's transactions in date order (block B0, transaction use
  case).

**Documents to align**

- `01-product-spec.md` §8: list `BUY` and `SELL`, others deferred.
- `05-data-model.md` §9 and §24: mark future types deferred, remove
  `cashValue`.
- `07-api-spec.md` §39: remove deposits and withdrawals as candidates.
- `12-demo-mode-spec.md`: remove cash from the demo data layout and
  "Insufficient simulated cash" from validation examples.

## Alternatives Considered

- **Cash ledger** (deposits, cash balance, buys consume cash). More
  realistic and gives standard return calculations, but needs a migration,
  a new enum, a reworked seed and an extended `UnitOfWork`, and it
  contradicts `00-overview.md` §5.2. Rejected for version 1; reachable later
  through point 5.
- **Forbidding backdated transactions.** Would make the oversell check
  against the current position sufficient, but CSV import is historical by
  definition. Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| Transactions with the same `executedAt` (common in CSV imports at day granularity) have no defined order, so chronological validation could accept or reject the same data differently in the API and the demo. | A deterministic tiebreak: `executedAt`, then creation order (row order for an import). The same rule applies in every runtime, with a test for a `BUY` and a `SELL` sharing a timestamp. | B0 |

## Related

- ADR-004 (analytics methodology), ADR-008 (CSV import)
- `00-overview.md` §5.2
