# B0.4 Shared contracts

Source: roadmap B0 lines 155-171; ADR-002; ADR-010 points 5 and 8. Depends on: B0.3.

## Allowed edit surfaces

packages/contracts/**
apps/api/src/schemas/**
apps/api/src/middleware/**
apps/api/src/controllers/**
apps/api/src/routes/**
docs/07-api-spec.md
docs/05-data-model.md
apps/api/package.json
apps/api/tsconfig.json
apps/api/vitest.config.ts
apps/api/src/services/analytics.service.ts
pnpm-lock.yaml

## Pre-flight (2026-10-10)

- `packages/contracts/` exists but is empty. Sibling packages (`@trading/domain`) use `"main": "./src/index.ts"` with no build step; follow that.
- `apps/api/src/schemas/` holds 13 files (472 lines); 12 controllers, 12 route files and `analytics.service.ts` import from it.
- Out of scope for this slice: the unmapped `CurrencyMismatchError` (500) and the readiness 503 body without `requestId` (a probe body documented in `07-api-spec.md`, not the error envelope). Mapping the first would change the B0.3 pinned tests, which must stay unchanged.

## Tasks

- [x] T1 Package scaffold; move request schemas from `apps/api/src/schemas/`. Route: delegated writer (46 files, mostly import rewrites; mapping trigger fired). Evidence: 13 schemas moved with `git mv` to `packages/contracts/src/`; 25 api importers now use `@trading/contracts`; `pnpm typecheck` clean; `pnpm --filter @trading/api test` 22 files, 315/315 (parent spot check); eslint clean. `@trading/contracts` depends on `@trading/domain` because alert, decision and scenario schemas import its enums. `apps/api` keeps its own `zod` dependency (used by `middleware/validate.ts` and controllers). The writer's first test run had 12 failures it did not capture; two reruns and the parent run passed (known first-run database flake).
- [ ] T2 Error envelope, pagination `meta`, `{ field, code, message }` details, drop `TIMEOUT`, 503 `DEPENDENCY_ERROR`.
- [ ] T3 Route-parameter validation (400 malformed, 404 unknown or foreign).
- [ ] T4 Response schemas and presenters per resource (one resource per commit); controllers stop serializing domain objects.
- [ ] T5 `theme` (`light|dark|system`) and `language` (`en|es`) validation; decisions `dateFrom/dateTo` filter on `createdAt`.
- [ ] T6 Contract tests of API responses against the schemas; align `07-api-spec.md`.

## Done when

B0.3 tests still pass unchanged; response contract tests pass.

## Verification

pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck.
