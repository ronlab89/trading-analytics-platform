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

- [ ] T1 Read the routing table of the app and list `{ method, path, validated schemas, authenticated }`.
- [ ] T2 Compare it with the operations (S1 to S3) with a failing case for each kind of drift, shown against a temporary registry.
- [ ] T3 Fix whatever the first real run finds.

## Done when

Adding a route without its operation, or changing a validated schema without the operation, turns the test red.

## Risk

None expected (test only). Anything T3 finds in routes or operations is listed in the log.

## Verification

pnpm --filter @trading/api test (this file), pnpm typecheck, pnpm lint.

## Log
