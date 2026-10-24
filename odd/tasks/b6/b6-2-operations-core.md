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

- [ ] T1 Portfolios and positions.
- [ ] T2 Transactions and the import/job endpoints.
- [ ] T3 Decisions and scenarios.

## Done when

The generated document lists these resources with request and response schemas and no hand-written JSON.

## Risk

None expected (data only). If a missing response schema forces a presenter change, re-check item 3.

## Verification

pnpm --filter @trading/contracts test, pnpm typecheck, pnpm lint.

## Log
