# B6.4 The test that fails when a route and its schema drift apart

Source: roadmap B6 "done when"; ADR-002 points 6 and 7; `10-testing-strategy.md` §52. Depends on: B6.3. Branch: `feat/b6-4-drift-test`. Test runner: Vitest.

Working rules: as B6.1.

Provisional: re-verified when the slice starts.

## Allowed edit surfaces

apps/api/src/**
packages/contracts/src/**
odd/tasks/b6/**

## Specs

- S1 A test walks the router of `createApp()` and compares it with the operations: a mounted route with no operation fails, an operation with no mounted route fails, and a method or path that differs fails.
- S2 For each route the test reads the schemas tagged by `validate()` (B6.1 S4) and fails when they are not the same schema objects as the operation's `params`, `query` and `body`.
- S3 Authentication: a route behind `authenticate` must be an operation that requires the token, and the other way round.
- S4 The failure message names the route and what differs, so a developer knows what to fix.
- S5 The test needs no database: it builds the app and reads its routing table, it sends no request.

## Tasks

- [x] T1 Read the routing table of the app and list `{ method, path, validated schemas, authenticated }`, fb960d4.
- [x] T2 Compare it with the operations (S1 to S3) with a failing case for each kind of drift, shown against a temporary registry, b134d97.
- [x] T3 Fix whatever the first real run finds: nothing to fix, the first real run found no drift.

## Done when

Adding a route without its operation, or changing a validated schema without the operation, turns the test red.

## Risk

None expected (test only). Anything T3 finds in routes or operations is listed in the log.

## Verification

pnpm --filter @trading/api test (this file), pnpm typecheck, pnpm lint.

## Log

L1 Request: "PR merged y develop actualizada, haz B6-4" (the plan was approved with the decisions taken from the recommendations)
L2 Decisions taken with the recommendation:

- D1 The walk and the comparison live in `apps/api/src/test-utils/openapi-drift.ts` (`readMountedRoutes`, `findDrift`); the test is `apps/api/src/openapi-drift.test.ts`. `findDrift` is a pure function, so each kind of drift is shown against a temporary registry and a hand-made route (S1 to S4) without touching the real app.
- D2 The walk reads `app.router.stack` of Express 5, recursing into mounted routers, and sends no request (S5). Authentication is whether `authenticate` is among the route handlers; schemas come from `validationOf` (B6.1) and must be the same objects as the operation's `params`, `query` and `body`.
- D3 A body with its own media type (the CSV import) is read raw, so an operation with `bodyContentType` may describe a body the route does not validate. Any other described-but-unvalidated, or validated-but-undescribed, params, query or body fails.
- D4 Every message names the method, the path and what differs, with the operation id when there is one.
- D5 The first real run found 58 routes against 58 operations and no drift (T3 had nothing to fix). A temporary check against a registry missing one operation, and against one with a flipped `authenticated`, failed with the expected messages; that file was removed.
- D6 Not checked, by design: headers, cookies, response schemas and status codes. They are not visible in the routing table; the route tests already validate responses against the schemas.
- Checks: 10 tests in the new file pass with the example test env; `tsc` and ESLint clean on `apps/api`. No route, operation or contracts file changed.
- Risk: none (test only).
