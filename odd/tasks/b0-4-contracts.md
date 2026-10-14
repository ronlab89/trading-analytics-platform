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
apps/api/src/errors/**

## T2 decisions (2026-10-10)

- Envelope and pagination `meta` already match ADR-002 at runtime; T2 adds Zod schemas and types for them in `@trading/contracts` (`errorResponseSchema`, `errorDetailSchema`, `paginationMetaSchema`).
- Validation details gain `code` from the Zod issue code (`custom` for `refine` issues). This necessarily changes one B0.3 assertion: `assets.routes.test.ts:560` (`from > to` details, exact equality). That single `toEqual` is updated; no other B0.3 test changes.
- `TIMEOUT` is removed from `AppErrorCode` and from `07-api-spec.md`. Mentions in docs 06, 10, 13, 15, the roadmap, PROGRESS and `sdd-source-of-truth.md` are outside the allowed surface and stay as drift to fix in T6.
- 503 `DEPENDENCY_ERROR`: `errorHandler` maps `PrismaClientInitializationError` and Prisma codes P1001, P1002, P1008, P1017 by duck-typing on `name`/`code` (no Prisma import in `apps/api`). Fixed message, no `Retry-After`, no dependency details in the body. Other Prisma errors stay 500. Logged through the existing `request.failed` line.
- `/health/ready` 503 stays as is.

## Pre-flight (2026-10-10)

- `packages/contracts/` exists but is empty. Sibling packages (`@trading/domain`) use `"main": "./src/index.ts"` with no build step; follow that.
- `apps/api/src/schemas/` holds 13 files (472 lines); 12 controllers, 12 route files and `analytics.service.ts` import from it.
- Out of scope for this slice: the unmapped `CurrencyMismatchError` (500) and the readiness 503 body without `requestId` (a probe body documented in `07-api-spec.md`, not the error envelope). Mapping the first would change the B0.3 pinned tests, which must stay unchanged.

## Tasks

- [x] T1 Package scaffold; move request schemas from `apps/api/src/schemas/`. Route: delegated writer (46 files, mostly import rewrites; mapping trigger fired). Evidence: 13 schemas moved with `git mv` to `packages/contracts/src/`; 25 api importers now use `@trading/contracts`; `pnpm typecheck` clean; `pnpm --filter @trading/api test` 22 files, 315/315 (parent spot check); eslint clean. `@trading/contracts` depends on `@trading/domain` because alert, decision and scenario schemas import its enums. `apps/api` keeps its own `zod` dependency (used by `middleware/validate.ts` and controllers). The writer's first test run had 12 failures it did not capture; two reruns and the parent run passed (known first-run database flake).
- [x] T2 Error envelope, pagination `meta`, `{ field, code, message }` details, drop `TIMEOUT`, 503 `DEPENDENCY_ERROR`. Route: read-only explorer, then one delegated writer (mapping and writer triggers fired). Evidence: RED observed (6 of 7 new tests failed, the non-DB 500 case passed), then GREEN; parent spot check: `pnpm typecheck` clean, eslint clean, contracts 6/6, API 24 files 322/322; the writer also ran `pnpm docs:check` (pass). New: `error.schema.ts` (codes without `TIMEOUT`, with `DEPENDENCY_ERROR`), `paginationMetaSchema`, `error-handler.test.ts`, `validate.unit.test.ts`. `AppErrorDetail.code` is now required (only `scenario.service.ts` builds details with a code and it already sets one). Zod 4 object-level `refine` still runs when a field already failed, so one input can yield a field detail plus a `custom` detail. Only B0.3 change: `assets.routes.test.ts` `from > to` assertion gained `code: "custom"`.
- [x] T3 Route-parameter validation (400 malformed, 404 unknown or foreign). Route: inline (one understood change across routers). Decision: lenient ID shape `^[A-Za-z0-9_-]{1,64}$` (not cuid) so B0.3 `does-not-exist` 404 tests stay unchanged. Evidence: RED observed (contracts and middleware tests failed, route table failed), then GREEN; user ran typecheck, eslint and `@trading/api` tests (after fixing a wrong `PATCH` for `POST /notifications/:id/read` in my own test). New: `params.schema.ts`, `validate(schema, "params")`, `params.routes.test.ts` (30 routes). `authenticate` runs before param validation.
- [x] T4 Response schemas and presenters per resource (one resource per commit); controllers stop serializing domain objects. Route: inline, one resource per commit (13 commits). Evidence: each resource had RED observed (new `*.response.test.ts` failing on the missing module), then GREEN; each test pins the presenter against `JSON.parse(JSON.stringify(entity))`, so the wire shape is provably unchanged, plus a no-leak test. User ran typecheck, eslint and the matching B0.3 route tests per commit. Shared: `response-common.schema.ts` (`moneySchema`, `presentMoney`, `presentTimestamp`, envelopes, `archiveMetaSchema`), `portfolioMetricsResponseSchema`. Resources: preferences, watchlist, notifications, alerts, portfolios, assets+market, positions, transactions, decisions, decision replay, analytics, overview, scenarios (CRUD, then calculate and compare). Gap: `/overview` has no route test (only presenter tests); close it in T6.
- [x] T5 `theme` (`light|dark|system`) and `language` (`en|es`) validation; decisions `dateFrom/dateTo` filter on `createdAt`. Route: inline. Evidence: preferences RED observed (5 of 13 new schema tests failed), then GREEN; `07-api-spec.md` updated (`Planned (B0)` removed, date filter documented); `docs:check` pass. The decisions filter already used `createdAt` with inclusive bounds in `prisma-decision-repository.ts`, so no code change: new `decisions.date-filter.routes.test.ts` pins it (characterization, passes on arrival; B0.3 file untouched). User ran typecheck, eslint and the API route tests.
- [ ] T6 Contract tests of API responses against the schemas; align `07-api-spec.md`. Also remove `--passWithNoTests` from the `test` script in `packages/contracts/package.json` once the package has tests (T1 review suggestion R3-001).

## Done when

B0.3 tests still pass unchanged; response contract tests pass.

## Verification

pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck.
