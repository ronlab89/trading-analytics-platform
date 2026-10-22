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
- [x] T2 Wire the key into the transaction creation route.
- [x] T3 `POST .../imports` with the CSV transport and the key.
- [x] T4 `GET`, retry and cancel routes.
- [x] T5 Route tests for permissions, ownership and 409s.

## Done when

Duplicate and concurrent submissions are pinned by tests, and no existing transaction route behaves differently without the header.

## Risk

Item 3 (a header on an existing route) and item 4 (concurrent reservations). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log

- 2026-10-21 Decisions (recommendations approved by the user's delegation):
  - The request hash is sha256 of the canonical JSON (sorted keys) of method, route pattern, path params and body, computed in the API layer.
  - Without the header nothing changes. The key is validated (1-255 printable ASCII, no spaces) and reserved after `authenticate`, params/body validation and, for imports, after the CSV body check, so a 400 never reserves a key.
  - The mutation stores its response in its own unit of work through an optional `withinUnit` hook on `createTransaction` and `createJob` (additive, same function without it). The middleware settles what the unit did not: a 4xx is stored, a 5xx is released and never stored; the `complete` after a successful unit is a no-op.
  - A replay answers the stored status and body with `Idempotency-Replayed: true`; the import `Location` header is not replayed.
  - Imports travel as a raw `text/csv` body with a route-level `express.text` limit of `IMPORT_MAX_BYTES` (1 MB); a JSON or empty body is 400 `VALIDATION_ERROR`, an oversized one 413.
  - Composition builds the job service, CSV handler, notifier and runner; only `index.ts` starts the runner and registers the `jobs` shutdown step, so tests never poll.
- Verification: typecheck and lint clean; idempotency service 9, middleware 16, jobs controller 13, transaction service 30 (2 new), job service 32 (2 new), job contract 4 tests pass. `jobs.routes.test.ts` (DB-backed) is written but was not run here (no test database). No independent verifier ran (risk items 3 and 4) because of the no-subagents rule.
- Risk: item 3 (a header on an existing route; the hooks are additive and absent without the header) and item 4 (concurrent reservations, covered by the B4.1 repository contract).
