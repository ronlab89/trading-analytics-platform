# ADR-003: Holdings-Only Portfolio with BUY and SELL Transactions

**Status:** Accepted
**Date:** 2026-10-04
**Implemented in:** already matches the code; documentation alignment only

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

## Consequences

**Positive**

- Consistent with `00-overview.md`: the product is analytics, not a
  brokerage.
- No migration or code change; the implementation already conforms.
- Performance stays honest without a cash model, through the cash-flow rule
  in point 3.

**Negative**

- Portfolio value excludes cash, so it is not a full account balance.
- The demo loses an "insufficient cash" failure case; overselling remains
  the representative validation failure.

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

## Related

- ADR-004 (analytics methodology)
- `00-overview.md` §5.2
