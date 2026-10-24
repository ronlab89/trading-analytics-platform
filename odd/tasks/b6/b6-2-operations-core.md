# B6.2 Operations: portfolios, positions, transactions, imports, decisions, scenarios

Source: roadmap B6; ADR-002 point 7; `07-api-spec.md`. Depends on: B6.1. Branch: `feat/b6-2-operations-core`. Test runner: Vitest.

Working rules: as B6.1.

Provisional: the route list below comes from `apps/api/src/routes/*.routes.ts` and is re-verified when the slice starts.

## Allowed edit surfaces

packages/contracts/src/**
odd/tasks/b6/**

## Specs

- S1 Every endpoint of `portfolios`, `positions`, `transactions`, `jobs` (including the CSV import, retry and cancel), `decisions` and `scenarios` has an `ApiOperation` that reuses the schemas the route already validates with and the response schema of `@trading/contracts`; no schema is copied.
- S2 Operations carry the headers and bodies the routes accept: the optional `Idempotency-Key` on transaction and import creation, the raw `text/csv` body of the import, `Retry-After` where a limiter answers it.
- S3 A response that has no Zod schema yet gets one in `@trading/contracts`, the same one the presenter output is checked against; if that changes a presenter, it is listed in the log.
- S4 Error statuses per operation follow `07-api-spec.md` (400, 401, 403 as 404 for foreign resources, 404, 409, 413, 429).

## Tasks

- [x] T1 Portfolios and positions (7 operations). Builder gained header parameters, other body media types and success headers first (0fa4a8f); operations in 4abb0cf.
- [x] T2 Transactions and the import/job endpoints (7 operations), cd908a1.
- [x] T3 Decisions (3) and scenarios (8), 5d8f844.

## Done when

The generated document lists these resources with request and response schemas and no hand-written JSON.

## Risk

None expected (data only). If a missing response schema forces a presenter change, re-check item 3.

## Verification

pnpm --filter @trading/contracts test, pnpm typecheck, pnpm lint.

## Log

L1 Request: "PR merged y develop actualizada, haz B6-2" (the plan was approved with the decisions taken from the recommendations)
L2 Decisions taken with the recommendation:

- D1 `ApiOperation` gained `headers`, `bodyContentType` and `success.headers` for what the core routes need (the `Idempotency-Key` request header, the `text/csv` import body, `Location` and `Idempotency-Replayed`). The builder adds `Retry-After` to every 429, which the rate limiter sends (standard headers, draft 7).
- D2 The operations live in `packages/contracts/src/operations/` one file per resource group, joined in `API_OPERATIONS`; `operations.test.ts` runs rules over the whole registry (ids and routes unique, path parameters equal the `params` keys, 401 only on private operations, 400 only where a request is validated, a body on every success except 204), so B6.3 is checked without new rules.
- D3 No response schema was missing: every route already had one in `@trading/contracts`, so no presenter changed (S3). Archive responses already carried their own envelope with `meta`.
- D4 Error statuses: 401 and 403 on every private operation, 429 everywhere (general limiter), 404 where a resource is looked up, 409 where a portfolio or scenario can be archived, a job state can forbid the action or an `Idempotency-Key` conflicts, 413 on the import.
- D5 The import limits (1 MB, 5000 rows) are written in the description because they live in `@trading/application`, which contracts must not import.
- D6 Response accuracy is not re-checked here: the route tests already validate responses against these schemas, and B6.4 compares the routes with the operations.
- Checks: contracts 245 tests pass; `tsc` and ESLint clean on `packages/contracts`. No `apps/api` file changed.
- Risk: none (data only in contracts).
