# B4.4 Endpoints and idempotency

Source: roadmap B4; ADR-008 points 8, 9 and Deferred detail (reservation, same-UoW write, request hash); `07-api-spec.md` §14-16, §39. Depends on: B4.3. Branch: `feat/b4-4-job-endpoints`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

apps/api/src/**
packages/application/src/**
packages/contracts/src/**
docs/07-api-spec.md
odd/tasks/b4/**

## Specs

- S1 `POST /portfolios/:portfolioId/imports` takes `Content-Type: text/csv` with a route-specific 1 MB body limit and answers 202 with the job; it needs `transaction:create`.
- S2 `GET /jobs/:jobId`, `POST /jobs/:jobId/retry` and `POST /jobs/:jobId/cancel` check permission and ownership; a disallowed state is 409.
- S3 `Idempotency-Key` works on `POST /portfolios/:id/transactions` and on import creation: the same key and request returns the stored response; a different request is 409 `CONFLICT`; two in-flight requests give 409 to the second.
- S4 The key and response are written in the same `UnitOfWork` as the mutation; the reservation has a 60-second lease; 5xx outcomes are not stored; the hash includes method, route and path parameters; expired rows count as absent.

## Tasks

- [x] T1 Idempotency middleware and service with the reservation, lease and hash, tested in memory.
- [ ] T2 Wire the key into the transaction creation route.
- [ ] T3 `POST .../imports` with the CSV transport and the key.
- [ ] T4 `GET`, retry and cancel routes.
- [ ] T5 Route tests for permissions, ownership and 409s.

## Done when

Duplicate and concurrent submissions are pinned by tests, and no existing transaction route behaves differently without the header.

## Risk

Item 3 (a header on an existing route) and item 4 (concurrent reservations). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log
