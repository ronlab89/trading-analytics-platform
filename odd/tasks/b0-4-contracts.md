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

## Tasks

- [ ] T1 Package scaffold; move request schemas from `apps/api/src/schemas/`.
- [ ] T2 Error envelope, pagination `meta`, `{ field, code, message }` details, drop `TIMEOUT`, 503 `DEPENDENCY_ERROR`.
- [ ] T3 Route-parameter validation (400 malformed, 404 unknown or foreign).
- [ ] T4 Response schemas and presenters per resource (one resource per commit); controllers stop serializing domain objects.
- [ ] T5 `theme` (`light|dark|system`) and `language` (`en|es`) validation; decisions `dateFrom/dateTo` filter on `createdAt`.
- [ ] T6 Contract tests of API responses against the schemas; align `07-api-spec.md`.

## Done when

B0.3 tests still pass unchanged; response contract tests pass.

## Verification

pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck.
