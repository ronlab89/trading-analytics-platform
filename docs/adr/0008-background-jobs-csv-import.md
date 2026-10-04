# ADR-008: Background Jobs, Scoped to CSV Transaction Import, and Idempotency

**Status:** Accepted
**Date:** 2026-10-04
**Implemented in:** roadmap block B4 (not yet implemented)

## Context

`00-overview.md` §44 lists asynchronous processing among the project's
goals, and the overview mentions background jobs and processes in several
other places. Yet no functional requirement asks for a specific job:
FR-069 is conditional ("where the real application uses asynchronous
processing"), and transactions are synchronous by design. Building a job
system with nothing to run violates NFR-070 (avoid artificial complexity).
Dropping it abandons a stated goal.

The documents also disagree on job states:

| Source | States |
|---|---|
| `07-api-spec.md` §15 | `QUEUED` … `CANCELLED` |
| `15-implementation-plan.md` §15 | queued, running, completed, failed, cancelled, timeout |
| `12-demo-mode-spec.md` §41-43 | adds progress, retrying, cancelling as states |
| `13-observability-spec.md` §43 | `job.timed_out` event |

`07-api-spec.md` §14 still describes asynchronous transaction creation with
a `jobId`, which the implementation does not do.

Retry safety (NFR-016, FR-075) is required independently of jobs: a
retried `POST` must not create a duplicate transaction.

## Decision

1. **Use case.** Importing transactions from a CSV file (new FR, P1). It is
   a real user need (bringing history from a broker) and genuinely long
   running: parsing, per-row validation, application and progress.
2. **Atomicity.** Two stages:
   - **Validate** every row, reporting progress. If any row fails, the job
     ends `FAILED` with a per-row report and nothing is written.
   - **Apply** all rows in a single `UnitOfWork`.
   No partial import can exist (FR-074).
3. **States.** `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`,
   `TIMED_OUT`. Progress is a field (`processed`, `total`), not a state.
4. **Runner.** In-process, backed by a `jobs` table in PostgreSQL. No
   separate worker process and no external queue.
5. **Restarts.** On startup, every job left in `PROCESSING` becomes
   `FAILED` with reason `INTERRUPTED` and is retryable. No job stays stuck
   silently.
6. **Retry and cancellation.** Retry returns a `FAILED`, `CANCELLED` or
   `TIMED_OUT` job to `QUEUED` and increments `attempt`. Cancellation is
   allowed while `QUEUED` or during the validation stage, never during the
   apply stage.
7. **Timeout.** Each job type has a timeout. Exceeding it moves the job to
   `TIMED_OUT` (NFR-017).
8. **Idempotency.** An `Idempotency-Key` header is supported on
   `POST /portfolios/:id/transactions` and on import creation. Keys are
   stored per user with a hash of the request and the resulting response,
   for 24 hours. Repeating a key with the same request returns the stored
   response; repeating it with a different request returns 409 `CONFLICT`.
   This mechanism is independent of the job system.
9. **Endpoints.**
   - `POST /api/v1/portfolios/:portfolioId/imports` (creates the job)
   - `GET /api/v1/jobs/:jobId`
   - `POST /api/v1/jobs/:jobId/retry`
   - `POST /api/v1/jobs/:jobId/cancel`
   All are checked for permission and ownership (ADR-005); importing
   requires `transaction:create`.
10. **Input limits.** File size and row count are bounded (values fixed in
    B4). Rows follow ADR-003 (`BUY` and `SELL` only) and ADR-004 (asset
    currency must match the portfolio's base currency).
11. **Realtime.** Channel `jobs:{jobId}` with `JOB_PROGRESS_UPDATED`,
    `JOB_COMPLETED` and `JOB_FAILED`, completing the catalog of ADR-007.
12. **Transactions stay synchronous.** The asynchronous transaction flow is
    removed from `07-api-spec.md` §14.
13. **Demo.** The same use case runs in process (ADR-001) with simulated
    progress and injectable failures (FR-069, FR-071).

## Consequences

**Positive**

- Asynchronous processing exists because a feature needs it, not as a
  showcase without purpose.
- One state model replaces four conflicting ones.
- All-or-nothing import keeps derived state consistent.
- Idempotency protects the most important mutation regardless of jobs.

**Negative**

- New tables (`jobs`, `idempotency_keys`) and migrations.
- A CSV parsing dependency, chosen in B4.
- An in-process runner shares resources with request handling; acceptable
  for a local deployment (ADR-006) and revisited only if measured.

**Documents to align**

- `02-functional-requirements.md`: new FR for CSV import.
- `07-api-spec.md` §14-16 and §39.
- `08-realtime-spec.md` (job channel and events).
- `12-demo-mode-spec.md` §41-43, `13-observability-spec.md` §43,
  `15-implementation-plan.md` §15 (state names).
- `05-data-model.md` (`Job`, `IdempotencyKey`).

## Alternatives Considered

- **No jobs in version 1.** Less work, but abandons a goal stated in
  `00-overview.md` and loses a useful feature. Rejected.
- **Asynchronous transaction creation.** Turns a fast operation into a slow
  one only to justify a job system. Rejected.
- **Separate worker with an external queue (for example Redis).** More
  infrastructure than a local deployment needs. Rejected.
- **Row-by-row import with partial success.** Leaves partial state and
  complicates retry. Rejected.

## Related

- ADR-001, ADR-003, ADR-004, ADR-005, ADR-007
- FR-069, FR-074, FR-075, NFR-016, NFR-017
