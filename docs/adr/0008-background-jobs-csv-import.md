# ADR-008: Background Jobs, Scoped to CSV Transaction Import, and Idempotency

**Status:** Accepted
**Date:** 2026-10-04
**Amended:** 2026-10-07 (point 4, retention of the stored input, approved by
the user from the `14-deployment-spec.md` reconciliation; Deferred detail row)
**Implemented in:** roadmap block B4 (not yet implemented)

## Context

`00-overview.md` §2.1 lists asynchronous processing among the project's
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
   separate worker process and no external queue. The job's input (the CSV
   content, bounded by point 10) is stored in the `jobs` row when the job is
   created, so resuming after a restart and retrying never depend on the
   original request. (Amended 2026-10-07, approved by the user from the
   `14-deployment-spec.md` reconciliation; `Planned (B4)`:) The stored input
   is kept while the job can still be retried (point 6) and is cleared for
   `COMPLETED` jobs and for jobs that `FAILED` with `VALIDATION_FAILED`.
5. **Restarts.** The apply stage sets the job to `COMPLETED` inside the same
   database transaction that writes the imported rows, so a job can never be
   both applied and not completed. On startup, every job left in
   `PROCESSING` therefore has written nothing; it becomes `FAILED` with
   reason `INTERRUPTED` and is retryable. On startup the runner also resumes
   every job still `QUEUED`. No job stays stuck silently.
6. **Retry and cancellation.** Retry returns a job to `QUEUED` and
   increments `attempt`. It is allowed for `TIMED_OUT`, `CANCELLED`, and
   `FAILED` with reason `INTERRUPTED`, `APPLY_ERROR` (technical failure
   during apply) or `APPLY_REJECTED` (a business rule rejected the apply,
   for example because the portfolio changed after validation; the retry
   re-runs validation from the start against current data). A job that
   `FAILED` because rows are invalid (reason `VALIDATION_FAILED`) is not
   retryable, since the same stored input would fail the same way; the user
   corrects the file and creates a new import. This is the complete set of
   failure reasons. Cancellation is allowed while
   `QUEUED` or during the validation stage, never during the apply stage.
   (Amended 2026-10-05.) A retry or cancel request for a job in a state
   that does not allow it returns 409 `CONFLICT` and changes nothing. A job
   reaching `COMPLETED` creates a `SUCCESS` notification for its owner, and
   one reaching `FAILED` or `TIMED_OUT` creates an `ERROR` notification.
   `CANCELLED` creates none, because the user caused it (ADR-010 point 9).
7. **Timeout.** Each job type has a timeout that applies while the job is
   `QUEUED` or validating. Exceeding it moves the job to `TIMED_OUT`
   (NFR-017). The apply stage is exempt, as it is from cancellation: it is a
   single database transaction that either commits or rolls back, so a
   retry can never import the same rows twice.

*Points 5 and 7 corrected on 2026-10-04 after review:* the original text did
not cover `QUEUED` jobs on restart, and allowed a timeout during the apply
stage, which could lead a retry to import the rows twice.
*Points 4 and 6 corrected on 2026-10-04 after a second review:* the original
text did not say where the input is stored, and allowed retrying a
validation failure that can only fail again.
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
    B4). Rows follow ADR-003 (`BUY` and `SELL` only, chronological
    validation) and ADR-004 (asset currency must match the portfolio's base
    currency).
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

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| Apply-stage failure path: validation can go stale before apply (a concurrent transaction makes a `SELL` oversell), or the database fails. | Apply re-checks invariants inside the `UnitOfWork`. A business-rule rejection ends `FAILED` with reason `APPLY_REJECTED` (retry re-runs validation); a technical failure ends `FAILED` with reason `APPLY_ERROR` (retryable). | B4 |
| Two in-flight requests carry the same `Idempotency-Key` before any response is stored. | Reserve the key with a unique constraint before processing; the second in-flight request gets 409. | B4 |
| Racing transitions: startup resume and in-memory enqueue pick the same job, and cancel can overwrite a committed apply. | Every transition is a compare-and-set on status, a persisted `stage` and `attempt`, checking affected rows. The apply `UnitOfWork` sets `COMPLETED` conditionally and rolls back if no row matches. | B4 |
| The idempotency record is written outside the mutation's transaction, so a crash between commit and record duplicates on retry; a crashed reservation blocks the key for 24 hours. | Write the key and response in the same `UnitOfWork` as the mutation. Reservations have a lease, and an expired lease counts as absent. 5xx outcomes are not stored. | B4 |
| A request hash covering only the body lets the same key and body against another portfolio return a stored response; expired rows still hit the unique constraint. | The hash includes method, route and path parameters. Expired rows are purged or treated as absent. | B4 |
| A timeout measured from creation makes retried or resumed jobs time out immediately. | The timeout is measured per attempt from when the job was queued. Startup handling of jobs past their deadline is defined. | B4 |
| Retry and cancel have no stated permission. | Retry requires `transaction:create`; cancel requires `transaction:create` on an owned job. | B4 |
| How the CSV reaches `POST .../imports`, and its body limit: the global JSON limit is 100 kB. | The transport and a route-specific body limit are set with the input limits of point 10. | B4 |

## Related

- ADR-001, ADR-003, ADR-004, ADR-005, ADR-007
- FR-069, FR-074, FR-075, NFR-016, NFR-017
