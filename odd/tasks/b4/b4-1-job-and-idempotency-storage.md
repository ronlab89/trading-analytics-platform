# B4.1 Job and idempotency storage

Source: roadmap B4 (`docs/BACKEND-ROADMAP.md`); ADR-008 points 3, 4, 8 and Deferred detail; `05-data-model.md`. Depends on: B3. Branch: `feat/b4-1-job-storage`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/domain/src/**
packages/persistence-memory/src/**
packages/database/prisma/**
packages/database/src/**
docs/05-data-model.md
odd/tasks/b4/**

## Specs

- S1 A `Job` entity with the states `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`, a persisted `stage`, `attempt`, progress (`processed`, `total`), the five failure reasons, the stored input and the deadline.
- S2 A `JobRepository` port whose every transition is a compare-and-set on status, `stage` and `attempt` that reports whether a row matched.
- S3 An `IdempotencyKey` entity and port: a unique reservation per user and key, a lease, the request hash and the stored response.
- S4 `TransactionalRepositories` carries the job and idempotency repositories, so the apply and the key share one `UnitOfWork`.
- S5 A hand-written migration creates `jobs` and `idempotency_keys`; the in-memory repositories pass the same contract suites as the Prisma ones.

## Tasks

- [x] T1 Domain: `Job` types, the state and reason enums, the allowed-transition table and its unit tests.
- [x] T2 Domain: `JobRepository` and `IdempotencyKeyRepository` ports; extend `TransactionalRepositories`.
- [x] T3 In-memory repositories and their contract suites.
- [x] T4 Prisma schema, migration and Prisma repositories with the same contract suites.
- [x] T5 `05-data-model.md` (`Job`, `IdempotencyKey`).

## Done when

The contract suites pass for both implementations, including a transition that matches no row and a reservation that collides.

## Risk

Item 1 (a migration adds two tables; no existing data changes) and item 3 (the `TransactionalRepositories` shape changes for its consumers). Its own commit for the migration.

## Verification

pnpm typecheck, pnpm lint, pnpm test, pnpm docs:check.

## Log

- 2026-10-21: the user delegated the whole of B4 (same terms as B3.4 and B3.5): Claude runs each slice and task one by one, commits after each, approves its own recommendations, and hands over only the push and `gh pr create`. Plan decisions taken: `csv-parse`, raw `text/csv` body, 1 MB and 5,000 rows, a 60-second lease, a 5-minute timeout per attempt, `TransactionalRepositories` carries `jobs` and `idempotencyKeys`.
- 2026-10-21: B4.1 done. Domain `Job` (states, stage, failure reasons, transition rules `isJobTransitionAllowed`/`canRetryJob`/`canCancelJob`) and `IdempotencyRecord`; ports `JobRepository` (create, getById, listByStatuses, transition as compare-and-set) and `IdempotencyKeyRepository` (reserve, complete, release, purgeExpired). In-memory and Prisma implementations pass the same contract suites; the Prisma `transition` uses `update` with the expected status, stage and attempt in its `where` (P2025 means no match). `reserve` must run outside a unit of work. Migration `20261021120000_add_job_and_idempotency_key_tables` is hand-written from `prisma migrate diff` (the local dev database was behind, so the diff held unrelated B2 changes that were left out). The Prisma integration tests and the migration against the test database were not run by Claude (reading `.env.test.local` was denied): the user runs `pnpm --filter @trading/database db:test:migrate` and `pnpm --filter @trading/database test`.
