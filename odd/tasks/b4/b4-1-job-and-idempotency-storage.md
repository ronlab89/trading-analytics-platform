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

- [ ] T1 Domain: `Job` types, the state and reason enums, the allowed-transition table and its unit tests.
- [ ] T2 Domain: `JobRepository` and `IdempotencyKeyRepository` ports; extend `TransactionalRepositories`.
- [ ] T3 In-memory repositories and their contract suites.
- [ ] T4 Prisma schema, migration and Prisma repositories with the same contract suites.
- [ ] T5 `05-data-model.md` (`Job`, `IdempotencyKey`).

## Done when

The contract suites pass for both implementations, including a transition that matches no row and a reservation that collides.

## Risk

Item 1 (a migration adds two tables; no existing data changes) and item 3 (the `TransactionalRepositories` shape changes for its consumers). Its own commit for the migration.

## Verification

pnpm typecheck, pnpm lint, pnpm test, pnpm docs:check.

## Log
