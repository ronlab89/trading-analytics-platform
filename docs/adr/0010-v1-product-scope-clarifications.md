# ADR-010: Version 1 Product Scope Clarifications

**Status:** Accepted
**Date:** 2026-10-05
**Implemented in:** roadmap block B0 (archived portfolios), B1 (What Changed); frontend stage (sorting, demo)

## Context

Reconciling `02-functional-requirements.md` (Phase 3, T3.1) left six
requirements that no ADR or spec defines precisely enough to build or test:

- FR-006 "What Changed" lists change types, including "significant value
  change" and "unusual volatility", but nothing defines "significant" or
  "unusual", and no endpoint exists.
- FR-015 "Search Transactions" has nothing to search: transactions have no
  free-text field, and FR-016 already filters them.
- FR-052 lists a `dismissed` notification state that `05-data-model.md` §21
  does not have.
- FR-055 asks for sorting, but only assets and transactions are paginated,
  and the API defines no sort parameters.
- FR-011 archives instead of deleting, yet the API still accepts
  transactions and other changes on an archived portfolio.
- The demo requirements (FR-050, FR-067, FR-068, FR-071 and FR-072, and the
  demo parts of FR-046 and FR-047) need decisions on demo data, reset,
  simulated latency and scripted failures. No ADR makes them.

## Decision

1. **What Changed (FR-006).** Version 1 reports only events that need no
   threshold, over the same period and boundaries as performance
   (`16-analytics-spec.md` §7-§8):
   - the largest contributor and the largest detractor, from range
     attribution (ADR-004 point 10). When contributions are all `≥ 0` there
     is no detractor, and when they are all `≤ 0` there is no contributor;
   - positions opened (quantity goes from 0 to above 0) and positions
     closed (quantity reaches 0);
   - alerts triggered in the period.

   "Significant value change", "unusual volatility" and "allocation
   changes" are `Deferred`. It is built as an application read model.
2. **Search Transactions (FR-015).** Satisfied by the FR-016 filters plus
   asset search (FR-020). No free-text transaction search in version 1.
3. **Notifications (FR-052).** Notifications are `unread` or `read` only.
   `dismissed` is removed from version 1.
4. **Sorting (FR-055).** Sorting happens in the client, and only for lists
   that are loaded in full. Paginated lists keep the API order documented in
   FR-014. Server-side sort parameters are `Deferred`.
5. **Archived portfolios (FR-011).** An archived portfolio is read-only. Any
   mutation scoped to it is rejected with 409 `CONFLICT` and nothing is
   written: creating or changing transactions, decisions, scenarios, alerts
   and CSV import jobs. Reads and the archive call itself are unchanged.
   Unarchiving is `Deferred`.
6. **Demo specifics.** Demo data layers, reset, simulated latency and
   scripted failures are decided in a frontend-stage ADR before the demo is
   built. They stay `Deferred` until then and do not block B0-B7. The demo
   itself remains decided (ADR-001, ADR-006).
7. **Benchmark comparison** (added 2026-10-05). Comparing portfolio
   performance with a market index or benchmark is `Deferred`. The system
   has no benchmark data, and no FR asks for it.

## Consequences

- `02-functional-requirements.md`: FR-006, FR-011, FR-015, FR-052 and FR-055
  get statuses and acceptance criteria from this decision. The demo FRs cite
  point 6.
- B0 adds the archived-portfolio guard to the application layer (ADR-001)
  and its tests. B1 adds the What Changed read model.
- Fewer features in version 1, but every remaining one is testable.

## Alternatives Considered

- **Define thresholds for "significant" and "unusual" now.** They would be
  product guesses with no data behind them. Rejected for version 1.
- **Free-text search over transaction notes.** Transactions have no notes
  field, and adding one is a feature nobody asked for. Rejected.
- **Server-side sorting on every list.** It adds API surface for lists that
  are small or already filtered. Rejected for version 1.
- **Allow writes to archived portfolios.** History could keep changing after
  archive, which defeats the purpose of archiving. Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| A portfolio is archived while a CSV import job for it is `QUEUED` or `RUNNING`. | The job checks the portfolio status inside the unit of work that applies rows (ADR-008). An archived portfolio fails the job with a non-retryable error, and no rows are written. | B4 |
| Two assets tie as the largest contributor or detractor. | The tie goes to the alphabetically first asset symbol, so the result is deterministic. | B1 |
| A position opens and closes within the same period. | Both events are reported, in date order. | B1 |

## Related

- `02-functional-requirements.md` FR-006, FR-011, FR-015, FR-052, FR-055,
  and the demo FRs
- ADR-001 (application layer), ADR-004 (attribution), ADR-008 (jobs)
- `16-analytics-spec.md` §7-§8, §14
