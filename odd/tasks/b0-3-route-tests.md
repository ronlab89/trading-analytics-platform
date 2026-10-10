# B0.3 Characterization route tests

Source: roadmap B0 lines 186-189; ADR-001 point 8; plan lines 410 and 632-644. Depends on: B0.1. Tests only, no production code changes.

## Allowed edit surfaces

apps/api/src/routes/**/\*.test.ts
apps/api/src/test-utils/**

## Pre-flight (2026-10-10)

- The helpers live in `apps/api/src/test-utils/` (`auth.ts`, `fixtures.ts`, `api-client.ts`); the original surface `apps/api/src/test/**` does not exist and was replaced.
- Pattern to copy: `routes/watchlist.routes.test.ts`. `createApp()` plus supertest against the real test database, `tokenFor`, `createTest*` fixtures and `cleanupTestData` in `afterAll`. No `vi.mock` in any route test.
- Missing fixture: `MarketPrice` and `HistoricalPrice` rows. Add a helper in `fixtures.ts`; both cascade-delete with their asset.
- Only the 503 branch of `GET /health/ready` needs a mock (`vi.mock` of `services/health.service.js`, `checkDatabaseConnection`).
- `GET /assets` shares global data: filter by a unique `search` before asserting `meta.total`.
- No route here checks roles; `authenticate` accepts any valid token.

## Behaviors to pin and bugs to record (do not fix)

- `position.service.ts` imports `./portfolio.service` and `../errors/app-error` without `.js`.
- `GET .../analytics/attribution` has no query validation; unknown params are ignored.
- A position with a zero average entry price makes the metrics throw and returns 500.
- Cross-currency portfolios make allocation and attribution throw `CurrencyMismatchError`; the mapping is unverified, likely 500.
- `GET /market/prices` does not deduplicate ids and never 404s on unknown ids; `assetIds=,` returns 400.
- The 503 body of `GET /health/ready` carries no `requestId`.

## Tasks

- [x] T1 Route tests for analytics. Route: delegated writer (2 non-trivial files). Evidence: `analytics.routes.test.ts` 19/19 green against the test database; `tsc --noEmit` clean. Added `createTestMarketPrice` and `createTestHistoricalPrice` to `fixtures.ts` for T3/T4. Pinned: a mixed-currency portfolio returns 500 `INTERNAL_ERROR` on both routes (`CurrencyMismatchError` is unmapped). Note: `createTestPosition` is USD-only, so non-USD cases use `prisma` directly. Run one file with `pnpm exec dotenv -e ../../.env.test.local -- vitest run <file>` from `apps/api`; `pnpm test -- <file>` runs the whole suite.
- [x] T2 Route tests for positions. Route: delegated writer (1 new file). Evidence: `positions.routes.test.ts` 19/19 green (writer run and parent spot check); `tsc --noEmit` clean. Pinned: the list route returns raw positions without metrics, so a zero-cost position still returns 200 there and only the detail route fails with 500 `PositionMetricsCalculationError` (cause asserted through the logged `errorName`). The list has no `orderBy`, so tests find items by id. Money serializes as `{amount: "100", currency: "USD"}`.
- [x] T3 Route tests for assets. Route: delegated writer (1 large test file plus a fixture option). Evidence: `assets.routes.test.ts` 59/59 green (writer run and parent spot check); eslint clean; `tsc --noEmit` clean. `createTestAsset` now takes optional overrides (`name`, `assetType`, `currency`, `exchange`, `status`). Pinned: the list is ordered by symbol ascending; `exchange` and `assetType` match case-sensitively (`stock` gives 400) while `currency` is uppercased; history validation runs before the asset lookup (unknown asset with a bad range gives 400); the `from > to` error detail has only `field` and `message`, no `code`; candles come back in ascending timestamp order with inclusive bounds; an empty search page returns `totalPages: 0`; money drops trailing zeros (`"150.5"`). The test file is about 577 lines, over the 400-line planning heuristic, kept whole because it is one route module.
- [x] T4 Route tests for market. Route: delegated writer (1 new file). Evidence: `market.routes.test.ts` 22/22 green (writer run and parent spot check); eslint clean; `tsc --noEmit` clean. Pinned: auth runs before validation; empty segments do not count toward the 50-id limit but duplicate ids do (51 copies of one id give 400); duplicates return one row per asset; unknown ids and assets without a price are absent, never 404; no `orderBy`, so tests match by `assetId`. Money drops trailing zeros (`"150.5"`). Note: the first vitest run can fail with "Can't reach database server" even with a healthy container; an immediate retry passes unchanged.
- [ ] T5 Route tests for `GET /health` and `GET /health/ready`.

Tests pin today's HTTP behavior (status, body shape) so the later layering refactor is provably unchanged. Do not fix bugs found here; record them in this file.

## Done when

All new tests pass against the current code.

## Verification

pnpm --filter @trading/api test.
