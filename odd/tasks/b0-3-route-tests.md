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
- [ ] T3 Route tests for assets.
- [ ] T4 Route tests for market.
- [ ] T5 Route tests for `GET /health` and `GET /health/ready`.

Tests pin today's HTTP behavior (status, body shape) so the later layering refactor is provably unchanged. Do not fix bugs found here; record them in this file.

## Done when

All new tests pass against the current code.

## Verification

pnpm --filter @trading/api test.
