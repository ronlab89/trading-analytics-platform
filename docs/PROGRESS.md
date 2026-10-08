# Trading Analytics Platform — Progress

> **Reconciled (2026-10-08).** The architecture decision records in
> `docs/adr/` take precedence over this file. The status below is being
> reconciled with them and with the code, slice by slice. The build order is
> backend-first: blocks B0 to B7 close the backend, then the frontend stage
> follows (`docs/BACKEND-ROADMAP.md`, `docs/15-implementation-plan.md` §4.1).
> The next block is **B0**.

**Last updated:** 2026-10-08. §1 and §2 are reconciled with the ADRs and the
code; later sections are reconciled in following slices and still describe
the work as it was done.
**Branch:** `docs/sdd-operations`, the source-of-truth work (ADRs 001-010,
phases 0-5 of `odd/tasks/sdd-source-of-truth.md`). It is documentation only,
carried on `docs/sdd-*` branches that are merged into `develop` through pull
requests; phases 0-4 are merged and phase 5 is not merged yet. `main` still
holds only the initial commit (`42839b1`); all earlier feature branches
(`feat/api-foundation`, `feat/decisions`, `feat/scenarios`) were merged into
`develop` through PRs #6, #7 and #8, not into `main`.

---

## 1. Current Phase & Step

**Build order (decided, `15-implementation-plan.md` §4.1):** minimal CI,
then the backend blocks **B0 to B7**, then the frontend blocks **FE0 to
FE6**. The two stages run in sequence; vertical slicing applies inside each
block. The blocks are defined in `docs/BACKEND-ROADMAP.md`:

- B0: application layer, shared contracts and minimal CI
- B1: portfolio performance and risk analytics
- B2: authentication and RBAC
- B3: observability foundation
- B4: background jobs and idempotency
- B5: realtime and market simulation
- B6: API documentation and contract
- B7: deployment readiness and hardening

**Where the project stands:** the backend API surface exists (§2), but the
backend is not done. **The next block is B0**: the application layer
(`packages/application`), shared contracts (`packages/contracts`), minimal
CI, the `Clock` port, route tests, chronological transaction validation and
the position-recalculation race. **No code for B0 has started**;
`packages/application` does not exist, `packages/contracts` and
`packages/config` hold only a `.gitkeep`, and `.github/` holds only the pull
request template.

**SDD reconciliation:** the spec set is `docs/00` to `docs/16` plus ADRs
001-010 (`docs/adr/`). Phases 0-4 of `odd/tasks/sdd-source-of-truth.md` are
merged into `develop`. Phase 5 (operations docs, roadmap and this file) is in
progress on `docs/sdd-operations`: `docs/BACKEND-ROADMAP.md` and `docs/15`
are reconciled, and this file is reconciled slice by slice.

**History (the original phase list, `15` §4), kept for the record:**

- **Phase 0 — Repository Foundation:** ✅ Complete
- **Phase 1 — Product/Domain Foundation:** ✅ Complete
- **Phase 2 — Database and Infrastructure:** ✅ Complete
- **Phase 3 — Backend/API Foundation:** ✅ Complete, including a hardening
  extension and a Market Data extension beyond the original plan scope
  (see §3 below)
- **Phase 4 — Authentication/RBAC:** ⏸ Partially done. JWT login +
  `authenticate` middleware exist and are tested. **RBAC (`requireRole`
  middleware) and a registration endpoint are not built**; token and logout
  semantics are decided in ADR-005 and the work belongs to **B2**.

The API was extended beyond the original phase list with the capabilities it
under-specified (Assets, Analytics, Overview, Market Data), then with the
small CRUD resources, Decisions and Scenarios:

- **Step D (small CRUD resources) is complete:** Watchlist, Alerts,
  Notifications, User Preferences, each with endpoints and HTTP-level
  integration tests (see §3.6).
- **Decisions + Replay is complete on the read side:** list, detail and
  replay endpoints, a pure `projectDecisionReplay` domain projection and
  real timestamps in the seed (see §3.7). The write endpoints (create,
  update, close) are **deliberately deferred**.
- **Scenarios is complete** (see §3.8): `changes` are part of the
  `Scenario` entity, with list/detail/create/update/archive/delete, a
  stateless `calculate`, and a `compare` endpoint backed by a pure domain
  function. Only duplicating a scenario (FR-041, P2) is deferred.

**Every resource in the data model now has an API**, except the
explicitly deferred pieces (decision writes, scenario duplicate, and
`MarketEvent`, which has none). The remaining backend work is the blocks
above: B0 first, then `performance` by period (B1), RBAC, registration,
refresh and logout (B2), observability (B3), jobs (B4) and realtime (B5).
None of the jobs, realtime, refresh or logout work is built.

---

## 2. What's Implemented (Architecture & Endpoints)

### 2.1 Monorepo structure

```text
apps/
  api/                  Express + TypeScript backend
packages/
  domain/               Pure domain layer (entities, calculations, repository contracts)
  database/             Prisma schema, migrations, seed, repository implementations
  contracts/            Placeholder (.gitkeep only); filled in B0
  config/               Placeholder (.gitkeep only)
docs/                   SDD documents (00-16), adr/ (ADRs 001-010) + this file
```

### 2.2 Domain layer (`packages/domain`)

- Entities with validation functions: User, Credential, Portfolio, Asset,
  Position, Transaction, Decision, DecisionEvent, Scenario,
  WatchlistItem, Alert, Notification, UserPreference, MarketEvent,
  MarketPrice, HistoricalPrice (all have entity files + tests; only
  User/Credential/Portfolio/Asset/Position/Transaction/MarketPrice/
  HistoricalPrice/WatchlistItem/Alert/Notification/UserPreference
  currently have API routes wired up; Decision/DecisionEvent are
  exposed read-only (list/detail/replay), and Scenario has a full API
  (see §2.4).
- `Money` value object (decimal.js-backed): `add`, `subtract`,
  `multiply`, `divide`, `isZero`/`isPositive`/`isNegative`, `equals`,
  `greaterThan`/`lessThan`, `toNumber`/`toString`/`toFixed`.
- Calculations, all pure and unit-tested:
  - `calculatePositionAfterTransaction` (weighted-average cost,
    `InsufficientPositionQuantityError` on oversell)
  - `calculatePortfolioMetrics`, `calculatePositionMetrics`
  - `calculateAllocation`, `calculateAttribution`
  - `calculateDrawdown`, `calculateVolatility` — **asset-level only**
    (documented scope limitation: true portfolio-level drawdown/
    volatility needs a reconstructed portfolio value time series from
    Transaction[], which does not exist yet)
  - `calculatePortfolioDailyChange` (new, Step C) — portfolio-level,
    value-weighted daily change from `MarketPrice` data (distinct from
    the asset-level drawdown/volatility above: this one genuinely
    aggregates across positions, since `MarketPrice` already carries
    the "since last tick" comparison per asset)
  - `calculatePortfolioPulse` — combines the above; volatility/drawdown
    are optional inputs supplied by the caller (classified `"UNKNOWN"`
    when absent) since the calculation module itself has no opinion on
    which asset's data to use
  - `calculateScenarioImpact`, built on `applyScenarioChanges` (new, the
    single definition of what a scenario change does to positions)
  - `compareScenarioImpacts` (new, Scenarios) — pure comparison of the
    baseline against N scenarios: per scenario the metrics, the
    difference (value, % of baseline or `null` when the baseline is
    zero, P/L) and a per-asset breakdown (value, difference,
    allocation, allocation shift in percentage points). Shared by the
    API and, later, the demo.
  - `projectDecisionReplay` (new, Decisions) — pure fold of a decision's
    chronological events into a replay state at a given index (`-1` =
    before the first event). Tolerates malformed events (reported in
    `issues`, never thrown). Shared by the API and, later, the demo.
- Repository contracts (interfaces only): one per entity, plus:
  - `pagination.ts` — shared `Page<T>` / `PageRequest` primitives, used
    by Asset and Transaction listings (and anything paginated going
    forward).
  - `unit-of-work.ts` — `UnitOfWork` interface for atomic multi-repository
    operations (see §3.2).

### 2.3 Database layer (`packages/database`)

- PostgreSQL via Docker Compose (`docker-compose.yml`), Prisma schema
  with the full `05-data-model.md` entity set already modeled (16
  models; migrations applied for all of it, even though several entities have
  no API yet).
- Prisma repository implementations exist for every entity in the data
  model, all exported from `packages/database/src/index.ts`.
- `PrismaUnitOfWork` implements `UnitOfWork` using Prisma's interactive
  `$transaction`; wraps `PrismaTransactionRepository` and
  `PrismaPositionRepository` bound to the transactional client.
- **Seed data** (`packages/database/src/seed/`), run via
  `db:seed`, step-based (`seed/steps/*.ts`, orchestrated by
  `seed/index.ts`):
  - Users/portfolios, assets, positions/transactions, decisions,
    scenarios, alerts, notifications — pre-existing.
  - **`seedHistoricalPrices`** (pre-existing, corrects a wrong note in
    an earlier version of this file that said this wasn't started
    yet): 7 assets × **90 daily candles each** (widened from 30 in Step
    C), deterministic generator (`seed/data/historical-prices.ts`),
    each series' final close is consistent with that asset's seeded
    `Position.currentPrice`.
  - **`seedMarketPrices`** (new, Step C): one current-price snapshot
    per asset, derived from the *same* generated candle series'
    last two closes (not re-queried from the DB — regenerated in
    memory from the same deterministic blueprint, guaranteeing no
    drift between the two seed steps). `timestamp` is the seed run
    time, not a historical date.
- **Two separate databases, by design:**
  - `trading_analytics_dev` — development data, used by `pnpm dev`,
    manual Postman testing, and the seed script. Config: `.env`.
  - `trading_analytics_test` — used exclusively by automated tests
    (both `packages/database` repository tests and `apps/api`
    integration tests). Config: `.env.test.local`. Created once
    manually via `CREATE DATABASE trading_analytics_test OWNER
    trading_user;`, migrated via `pnpm --filter @trading/database
    db:test:migrate` (`prisma migrate deploy`, not `dev` — applies
    existing migrations without prompting or generating new ones).
  - **Rationale:** avoids polluting manually-curated Postman/dev data
    with data created and torn down by test runs, and matches
    `10-testing-strategy.md` §17/§42 (tests must not depend on
    production/dev data; CI needs an isolated disposable database).
  - Templates committed: `.env.example`, `.env.test.example`. Real
    files (`.env`, `.env.test.local`) are git-ignored.

### 2.4 API layer (`apps/api`)

**Architecture:** `routes/*.routes.ts` (thin, just middleware + handler
wiring) → `controllers/*.controller.ts` (parses `req.validated`, calls
service, shapes HTTP response) → `services/*.service.ts` (business
orchestration, ownership checks) → repositories (`@trading/database`).
This three-layer split was introduced by the user mid-project (routes
used to contain handler logic inline); all currently-implemented
resources follow it.

**`app.ts` vs `index.ts`:** `createApp()` in `app.ts` builds a fully
configured Express app (all middleware + routes), no `listen()` call.
`index.ts` just imports `createApp` and calls `.listen()`. This split
exists specifically so integration tests can exercise the real app via
supertest without binding a port. `createApp()` mounts 15 routers (health
plus 14 resource routers).

**Middleware stack (in order, see `app.ts`):** `helmet()` → `cors()`
(origin from `CORS_ORIGIN`) → `requestId` → `healthRouter` (before rate
limiting, so monitors never get 429) → `generalApiRateLimiter` (300/15min,
skipped when `NODE_ENV=test`) → `express.json({ limit: "100kb" })` →
resource routers → 404 handler (routed through `AppError`) →
`errorHandler` (must be last).

**Error handling (`middleware/error-handler.ts`):** normalizes to
`{ error: { code, message, requestId, details? } }`. Recognizes, in
order: body-parser errors (malformed JSON → 400, oversized body → 413),
domain validation errors by naming convention (`/^(Invalid|Insufficient).+Error$/`
→ 400 `VALIDATION_ERROR`), `AppError` instances (explicit code/status),
anything else → 500 `INTERNAL_ERROR` with no leaked internals.

**Validation (`middleware/validate.ts`):** generic `validate(schema, "body" | "query")`
factory using Zod; stores parsed/coerced output on `req.validated.{body,query}`
rather than overwriting Express's native `req.body`/`req.query` typing.

**Authentication (`middleware/authenticate.ts`):** JWT via
`Authorization: Bearer <token>`. Single generic 401 for every failure
mode (missing header, malformed token, invalid signature, expired,
malformed payload) — never reveals which one applies.

**Implemented endpoints:**

| Resource | Endpoints | Notes |
|---|---|---|
| Auth | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | Login has its own stricter rate limiter (5/15min, also test-skipped). `/me` re-fetches from DB, doesn't trust JWT payload alone. |
| Portfolios | `GET/POST /api/v1/portfolios`, `GET/PATCH /api/v1/portfolios/:id`, `POST /api/v1/portfolios/:id/archive` | `baseCurrency` immutable after creation. Archive is idempotent (200 + `meta.alreadyArchived`, never 409). Cross-user access → 404, never 403. |
| Positions | `GET /api/v1/portfolios/:id/positions`, `GET .../positions/:positionId` | Read-only — positions are a derived projection of transactions, no write endpoints by design. |
| Transactions | `GET/POST /api/v1/portfolios/:id/transactions` (paginated, filterable), `GET .../transactions/:transactionId` | Creation is **synchronous** (not the async job/jobId flow in `07-api-spec.md` §14 — deferred to Phase 10, Background Operations). Wrapped in `PrismaUnitOfWork`: transaction record + position recalculation + status update commit or roll back together. |
| Assets | `GET /api/v1/assets` (paginated, filters: search/assetType/exchange/currency/status), `GET /api/v1/assets/:assetId` | Global reference data, no ownership. `getByIds()` added for batch enrichment (avoids N+1 when building overview/analytics). |
| Market Data (new, Step C) | `GET /api/v1/assets/:assetId/price`, `GET /api/v1/market/prices?assetIds=...` (batch, up to 50, never 404s — unknown ids just absent), `GET /api/v1/assets/:assetId/history?from=&to=&interval=` | `/price` distinguishes "asset doesn't exist" from "asset exists, no price yet" (both 404, different message — no anti-enumeration concern, assets are public reference data). `interval` currently only accepts `"1d"` (400 for anything else) — only daily candles exist; **user has confirmed weekly/monthly aggregation is a planned future addition**, not needed now. |
| Analytics | `GET /api/v1/portfolios/:id/analytics/allocation?groupBy=asset\|assetType\|currency`, `GET .../analytics/attribution` | `sector` grouping and attribution `from/to/groupBy` from the spec are deferred — no data exists yet to support them meaningfully. |
| Overview | `GET /api/v1/portfolios/:id/overview` | Purpose-built read model: portfolio + summary + positions (each with `allocationPercent` **and now `dailyChange`**, Step C) + allocation + attribution + last 5 transactions + **`dailyChange`** (portfolio-level) + **`pulse`** (Step C). `performance` (FR-025/026, historical performance by period) remains the one deliberately omitted field — it needs a portfolio value time series reconstructed from Transaction[], a distinct piece of design not yet built. |
| Health | `GET /health`, `GET /health/ready` | Registered before rate limiting. |
| Watchlist (Step D) | `GET/POST /api/v1/watchlist`, `DELETE /api/v1/watchlist/:assetId` | User-scoped (no portfolio in the path). Add validates the asset exists (404) and relies on the repo's unique constraint for duplicates (400 `VALIDATION_ERROR`). Remove checks existence first via the new `getByUserAndAsset` (404 instead of a raw Prisma P2025 → 500). |
| Alerts (Step D) | `GET/POST /api/v1/alerts`, `GET/PATCH/DELETE /api/v1/alerts/:alertId` | Create verifies a referenced `portfolioId` belongs to the caller and a referenced `assetId` exists; at-least-one-target rule enforced by both the Zod schema and `validateNewAlert`. PATCH edits only `condition`/`threshold`/`enabled` (what an alert monitors is immutable — a different target is a new alert). |
| Notifications (Step D) | `GET /api/v1/notifications?unreadOnly=`, `POST /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all` | No create endpoint by design (notifications come from system events). Mark-read checks ownership via the new `getById` first (`markAsRead` takes a bare id). See §3.6 for the deliberate divergence from `07-api-spec.md` §28. |
| Preferences (Step D) | `GET/PATCH /api/v1/preferences` | One row per user, created lazily. `GET` with no saved row → `200` with `data: null` (not 404, and a read never writes). `PATCH` is an atomic upsert; `defaultPortfolioId` must belong to the caller (404 otherwise), `null` clears it. |
| Decisions (read-only) | `GET /api/v1/portfolios/:id/decisions` (filters: assetId/direction/dateFrom/dateTo, not paginated), `GET .../decisions/:decisionId`, `GET /api/v1/decisions/:decisionId/replay` | Replay is not nested under a portfolio (per the spec): ownership is resolved decision → portfolio → user, same 404 for missing and foreign. Returns `decision`, chronologically ordered `events`, the asset's `currency` and `initialState` (projection at index -1). Create/update/close are deferred, see §3.7. |
| Scenarios | `GET/POST /api/v1/portfolios/:id/scenarios` (list filter: `status`), `GET/PATCH/DELETE .../scenarios/:scenarioId`, `POST .../scenarios/:scenarioId/archive`, `POST .../scenarios/:scenarioId/calculate`, `POST .../scenarios/compare` | Nested under a portfolio like Transactions; cross-user and wrong-portfolio access are the same 404. Reset and save need no endpoints: `PATCH` with `changes: []` and `status: "SAVED"`. `changes` replace the whole list. `ARCHIVED` is read-only (409 on `PATCH`, no un-archive) and reached only via the idempotent archive endpoint. `calculate` and `compare` are read-only POSTs; results are never stored. Details in §3.8. |

**Cross-cutting decisions worth remembering:**
- Cross-user resource access is always 404, never 403 (anti-enumeration,
  `09-security-spec.md` §14-15, §51). Applied consistently across
  portfolios, positions, transactions, alerts, notifications (and the
  `defaultPortfolioId` preference).
- `Page<T>`/`PageRequest` pattern (from `packages/domain`) is the
  standard for every list endpoint that needs pagination — established
  first for Assets, then reused for Transactions. Response shape:
  `{ data: T[], meta: { page, pageSize, total, totalPages } }`.
- No fabricated metrics anywhere. Where a calculation needs data that
  doesn't exist yet, the corresponding field is either absent, or (for
  Pulse's optional dimensions) explicitly classified `"UNKNOWN"` rather
  than estimated or hardcoded.
- **"Insufficient data" vs. "valid empty state" is a recurring, deliberate
  distinction** across domain calculations: an empty portfolio (zero
  positions) always returns a valid zeroed result; a portfolio *with*
  positions but missing the specific data a calculation needs (e.g. no
  `MarketPrice` yet) throws `InsufficientDataError`, which the calling
  service catches and turns into `null`/`"UNKNOWN"` rather than a 500.

---

## 3. Hardening & Extensions Done This Session (beyond original phase scope)

After Phase 3's core endpoints were built, a self-review pass surfaced
technical debt and gaps, closed in order (§3.1-3.4), followed by the
Market Data extension (§3.5).

### 3.1 Known-debt closure (pre-Step A)

- Added `"build": "tsc --build"` scripts to `packages/domain` and
  `packages/database`, plus a root `"build": "pnpm -r build"`.
- Fixed a relative-import workaround (`../../../../packages/domain/src/index.js`)
  in 4 `apps/api` files — root cause was `@trading/domain` missing from
  `apps/api/package.json` dependencies. Now imports by package name
  everywhere.
- Prisma Studio issue: **deliberately not fixed** — user uses TablePlus
  instead and has no need for it.

### 3.2 Atomicity via Unit of Work

- `createTransaction` previously ran 3 sequential writes (create
  transaction → recalculate position → update status) with no
  transactional guarantee — a failure mid-sequence could leave an
  orphaned `DRAFT` transaction (violated FR-074, NFR-015).
- Added `UnitOfWork` interface (`packages/domain`) +
  `PrismaUnitOfWork` (`packages/database`, uses Prisma's interactive
  `$transaction`). `PrismaTransactionRepository` and
  `PrismaPositionRepository` now accept an optional client in their
  constructor (default: shared `prisma` instance), so they can be bound
  to a transaction scope.
- Verified with a dedicated integration test
  (`prisma-unit-of-work.test.ts`): commits on success, rolls back and
  rethrows the original error on failure.
- The mock/demo repositories (when built) can implement the same
  `UnitOfWork` interface with in-memory snapshot/rollback — the
  contract doesn't assume Prisma.

### 3.3 Step A — API hardening

- `error-handler.ts` now recognizes body-parser errors specifically:
  malformed JSON → 400 `VALIDATION_ERROR` (was falling through to 500),
  oversized body → 413 (was also 500).
- `express.json()` given an explicit `100kb` limit (`09-security-spec.md`
  §27 requires an explicit, stated limit — matches Express's own
  default, but is now a visible decision rather than an implicit one).
- Port configuration unified: `env.ts` now validates `PORT` (default
  **7001**, not the earlier mismatched default of 3000); `index.ts`
  reads `env.PORT` instead of `process.env.PORT` directly.
  `.env.example` updated to match.
- `/health` and `/health/ready` moved before the rate limiter in the
  middleware chain, so uptime monitors/orchestrators never receive 429.

### 3.4 Step B — Testability + integration test suite

**B.1 — Separate test database** (see §2.3 above for the two-database
rationale). `packages/database`'s `test`/`test:watch` scripts now load
`.env.test.local` instead of `.env`; new `db:test:migrate` script
(`prisma migrate deploy`).

**B.2 — `createApp()` extraction + tooling:**
- `apps/api/src/app.ts` (new): all Express wiring, no `listen()`.
- `apps/api/src/index.ts`: reduced to `createApp()` + `.listen()`.
- Added `NODE_ENV` to `env.ts` (`development | test | production`,
  default `development`).
- `rate-limit.ts`: both limiters now `skip` when `NODE_ENV=test` — a
  shared in-process app instance in the integration suite would
  otherwise trip the IP-based counter across unrelated test cases.
  The 429 behavior itself is verified separately (see below), not lost.
- Added `vitest`, `supertest`, `@types/supertest` to `apps/api`. New
  `test`/`test:watch` scripts, also loading `.env.test.local`.
- Smoke test (`app.test.ts`) written first to validate the wiring
  before building the full suite.

**B.3 — Integration test suite** (7 files, all in `apps/api/src/`):
- `test-utils/api-client.ts` — `body<T>(response)` typed-cast helper
  (avoids repeating `response.body as {...}` in every test; the one
  `no-unnecessary-type-parameters` lint case where the generic
  appearing only in return position is intentional and suppressed
  with a comment explaining why).
- `test-utils/fixtures.ts` — `createTestUser` (real bcrypt hash, so
  HTTP login actually works — **no registration endpoint exists yet**,
  so this seeds identity directly via repositories), `createTestPortfolio`,
  `createTestAsset`, `cleanupTestData` (deletes in dependency order:
  transactions/positions → portfolios/credentials → users; assets
  separately).
- `routes/auth.routes.test.ts` — valid login + follow-up `/me` call,
  wrong password (generic message, no enumeration), unknown email
  (same generic message), `/me` without token, `/me` with malformed
  token.
- `routes/portfolios.routes.test.ts` — create, validation 400 with
  field-level detail, list scoped to owner only, **404 (not 403) on
  cross-user access** (both GET-by-id and PATCH), 404 for a
  well-formed-but-nonexistent id, update excludes `baseCurrency`,
  archive idempotency (`meta.alreadyArchived` false then true).
- `routes/transactions.routes.test.ts` — BUY opens a position,
  validation 400 for non-positive quantity, **SELL exceeding held
  quantity: verifies 400 AND that no orphaned transaction was
  persisted AND that the position was left untouched** (the actual
  Unit-of-Work regression test, checked via the transactions list and
  the overview endpoint), 404 for a nonexistent asset.
- `middleware/validate.test.ts` — malformed JSON → 400 (no DB
  needed), oversized body → 413 (needs a valid JWT to reach the route,
  no DB row required since `userId` is never looked up before the
  size check fires).
- `middleware/rate-limit.test.ts` — **deliberately does not test the
  real exported limiters** (skipped under `NODE_ENV=test` for suite
  stability — see above). Instead builds an isolated mini Express app
  with its own tiny-threshold limiter, reusing the same
  `rateLimitHandler` (now exported from `rate-limit.ts` specifically
  for this reuse) to verify the 429 response shape independently.

**Result at the time:** 22 tests across 6 files, all passing.

### 3.5 Step C — Market Data (this session's final block)

**Correction to an earlier version of this file:** `HistoricalPrice`
seeding was **already implemented** before this session (it was
mistakenly listed as "not started" previously) — only `MarketPrice`
seeding and all price/history API endpoints were actually missing.

**C.1 — MarketPrice + price/history endpoints:**
- Widened seeded history from 30 to 90 daily candles per asset
  (`seed/data/historical-prices.ts`), user-confirmed.
- New `seed/steps/seed-market-prices.ts`: derives each asset's current
  `MarketPrice` from the last two candles of its *own* deterministic
  series (regenerated in memory, not re-queried from the DB — zero
  drift risk between the two seed steps). Registered in `seed/index.ts`
  right after `seedHistoricalPrices`.
- New `schemas/market.schema.ts`: `batchPricesQuerySchema` (CSV →
  array, 1-50 ids), `assetHistoryQuerySchema` (`from`/`to` with a
  `refine` ensuring `from <= to`, `interval` restricted to the literal
  `"1d"` — user confirmed this is fine for now, with weekly/monthly
  aggregation planned as a distinct future addition once actually
  needed, not before).
- New `services/market.service.ts`: `getAssetPrice` (two distinct 404
  messages: asset missing vs. asset exists but no price yet),
  `getBatchPrices` (never 404s, same "missing means absent" contract
  as `Asset.getByIds`), `getAssetHistory`.
- Extended `controllers/assets.controller.ts` + `routes/assets.routes.ts`
  with `/price` and `/history` handlers/routes.
- New `controllers/market.controller.ts` + `routes/market.routes.ts`
  for the batch endpoint (`/market/prices` isn't nested under
  `/assets`, so it got its own router), registered in `app.ts`.

**C.2 — Overview extended with `dailyChange` and `pulse`:**
- New domain calculation `calculations/portfolio-daily-change.ts`
  (`calculatePortfolioDailyChange`), unit-tested (5 cases: empty
  portfolio, correct value-weighting across positions of very
  different size/percent-move, partial exclusion when some assets lack
  price data, `InsufficientDataError` when *no* asset has price data,
  degenerate zero-previous-value case). Exported from
  `packages/domain/src/index.ts`.
  - Deliberately uses `MarketPrice.previousPrice`/`.change` (the "since
    last tick" comparison), not `HistoricalPrice` — a different, later
    concept already used by drawdown/volatility.
  - Same "insufficient data vs. valid empty state" distinction as the
    rest of the domain layer (see §2.4 cross-cutting notes).
- `overview.service.ts` extended:
  - Per position: new `dailyChange: { changeValue, changePercent } | null`
    field — `changePercent` reuses `MarketPrice.changePercent` directly
    (no recomputation), `changeValue` is `change × quantity`. `null`
    when the asset has no current `MarketPrice` yet.
  - Portfolio-level: new `dailyChange: PortfolioDailyChange | null`
    field, via `calculatePortfolioDailyChange`. `null` only when
    positions exist but none have price data; empty portfolio still
    returns a zeroed (non-null) result.
  - New `pulse: PortfolioPulse` field (always present). Internal
    `getPulseInputs()` helper identifies the largest-weight position
    (same concentration-driven proxy the "concentration" pulse
    dimension itself already uses), fetches its full historical price
    series (wide `from`/`to` window — `new Date(0)` to `new Date()` —
    specifically so this doesn't depend on the seeded dates lining up
    with the real wall-clock date the server runs on), and computes
    volatility/drawdown for that one asset, degrading each to
    `undefined` (→ Pulse's `"UNKNOWN"`) individually on
    `InsufficientDataError` rather than failing the whole request.
  - Hit and fixed one `exactOptionalPropertyTypes: true` TS error along
    the way: an optional property (`{ volatility?: X }`) cannot be
    assigned an explicit `undefined` under this tsconfig setting — had
    to build the returned object with conditional spreads
    (`...(x !== undefined ? { x } : {})`) instead of `{ volatility,
    drawdown }` directly. Worth remembering as a recurring gotcha in
    this codebase for any future optional-field construction.
  - `performance` by period (FR-025/026) remains explicitly deferred —
    user confirmed treating it as a distinct future step, not part of
    Step C.

**Verification:** typecheck, lint, and all existing test suites passed
after both C.1 and C.2 (no new automated tests were added for the
overview wiring itself — the underlying calculations are unit-tested;
manual Postman verification confirmed response shape/values).

### 3.6 Step D — Watchlist, Alerts, Notifications, User Preferences

All four followed the established routes → controllers → services →
repositories pattern (`schemas/*.schema.ts` for Zod, `services/*` for
ownership + orchestration). The domain/database layers needed only
small, deliberate changes:

- **Watchlist:** added `getByUserAndAsset(userId, assetId)` to the
  `WatchlistItemRepository` contract + Prisma implementation (+ test).
  Chosen over an in-memory scan of `listByUserId` because it uses the
  existing `userId_assetId` unique index and mirrors the "get, check,
  then act" shape of the other services.
- **Notifications:** added `getById(id)` to the contract + Prisma
  implementation (+ test), needed to verify ownership before
  `markAsRead(id, ...)`, which takes no `userId`.
- **User Preferences:** `PrismaUserPreferenceRepository.update` changed
  from `prisma.userPreference.update` (threw P2025 → 500 when no row
  existed) to an atomic `upsert`. The domain contract already allowed
  this ("created lazily on first write"). Column defaults
  (`theme="system"`, `language="en"`, `reducedMotion=false`,
  `notificationPreferences={}`) stay solely in `schema.prisma` — not
  duplicated in TypeScript. Test added for the first-write path.
- **Alerts:** no domain/database changes needed.

**Deliberate divergences from the SDD (to reflect back into it):**
- `07-api-spec.md` §28 lists `read`/`type`/`page`/`pageSize` filters for
  notifications. `NotificationRepository.listByUserId` only supports
  `unreadOnly` and does not paginate, so the API exposes exactly
  `unreadOnly` rather than advertising filters it cannot honor.
  `type` filtering and pagination are deferred until there is a
  concrete need (NFR-070).
- `GET /api/v1/preferences` returns `{ data: null }` for a user with no
  saved preferences (absence is a valid state, same principle as the
  null `dailyChange` in Overview). `07-api-spec.md` §29 does not
  specify this case.

**Integration tests (4 new files in `apps/api/src/routes/`):**
`watchlist.routes.test.ts`, `alerts.routes.test.ts`,
`notifications.routes.test.ts`, `preferences.routes.test.ts`. Each
covers 401 without token on every endpoint (`it.each`), 404 (never
403) on cross-user access with the target left untouched, field-level
400 validation, and the happy paths. New shared helpers:
`test-utils/auth.ts` (`tokenFor(userId, role?)` — signs a JWT like
`auth.service.ts`, so tests can act as a user without HTTP login) and
`createTestNotification` in `test-utils/fixtures.ts` (notifications
have no create endpoint, so tests seed them via Prisma). Existing
tests (`portfolios`/`transactions`) still inline their own token
signing; migrating them to `tokenFor` is optional cleanup.

**Verification:** typecheck, lint and the full test suites passed.

### 3.7 Decisions + Replay (read side)

Done in three slices on `feat/decisions`; the write side was
evaluated and deferred on purpose.

**Slice 1 — real timestamps.** `CreateDecisionInput` now accepts an
optional `createdAt` and `CreateDecisionEventInput` an optional
`timestamp` (default: now), both validated as real dates. This reverses
the earlier "timestamp always repository-assigned" decision: without it,
every seeded event got the seed-run time (milliseconds apart, so a
replay timeline had no real time span and ordering could tie), and
`createdAt` could be later than `closedAt`. Justified by
`05-data-model.md` §40 (event time vs. creation time must be
distinguishable). The seed now passes the blueprints' real dates; only
the mappers changed in `packages/database` (repositories delegate).

**Slice 2 — `projectDecisionReplay`** (`packages/domain/src/calculations/
decision-replay.ts`). Signature `projectDecisionReplay({ decision,
events, currency }, currentIndex)`. Pure; does not mutate inputs
(FR-034). `currency` is passed by the caller (the asset's) because
`Decision` has no currency of its own. Out-of-range index throws
`DecisionReplayError`; malformed or out-of-sequence events never throw,
they are ignored and listed in `issues`. Tracks phase
(`PLANNED`/`OPEN`/`CLOSED`), thesis, risk level, notes, position,
last price, unrealized and realized P/L (SHORT inverts the sign; NEUTRAL
is computed like LONG). Position increases use a weighted-average entry
price, reductions realize P/L; quantity deltas go through `Decimal`.
Payload conventions per event type are now documented in
`05-data-model.md` §12 (they were previously implicit in the seed).
Placed in the domain, not the application layer, so the API and the
demo share the same projection (corrects an old comment in
`decision-event.ts`).

**Slice 3 — read endpoints** (see the §2.4 table). Deliberate
divergences, reflected in `07-api-spec.md` §23-24: no `outcome`,
`page` or `pageSize` (the repo does not support them), list responds
`{ data }` without `meta`, and the replay response adds `currency`.
19 integration tests in `decisions.routes.test.ts`; new
`createTestDecision` fixture (events can be passed out of order to prove
the API sorts them). `cleanupTestData` needed no change: Portfolio →
Decision → DecisionEvent cascade.

**Slice 4 — write endpoints: DEFERRED (option C).** Create, update and
close are annotated as deferred in `07-api-spec.md` §23. Reasons: no FR
asks for them (FR-032/033/034 are read and replay only); events cannot
be generated honestly by the service (no `DECISION_CLOSED` type,
`POSITION_CLOSED` needs an exit price the close endpoint does not
receive, and `Decision` has no link to `Transaction` to derive position
events); and writing decisions properly needs `UnitOfWork` extended so a
decision and its events are created atomically (FR-074), repeated later
in the demo mock. If the frontend needs to create decisions, design it
then together with an event-journal endpoint
(`POST .../decisions/:decisionId/events`) with the screen in view.

**Verification:** typecheck, lint and the domain, database and api test
suites passed after slices 1 to 3.

### 3.8 Scenarios

Done in four slices on `feat/scenarios`. Unlike Decisions, writing is
required here: FR-036/037/038/039/042 are P1 (FR-040/041/043 are P2).

**Slice 1 — `changes` on the entity.** The persisted `changes` could
be written (`updateChanges`) but never read back, so a saved scenario
could not be calculated, shown or duplicated. `Scenario` now carries
`changes: readonly ScenarioChange[]` (reverses the earlier decision to
leave them out, justified by `05-data-model.md` §15: a scenario *is* its
modifications). `ScenarioChange` was declared twice (calculation and
repository contract); it now has a single declaration in
`entities/scenario.ts`. New `validateScenarioChanges`: finite
percentage, not below -100%, one entry per asset; `create` accepts
`changes` (default none). The mapper reads the JSON column defensively
(non-array → no changes, malformed entries skipped, never a 500; trade
off: it can hide corruption). No migration was needed (`changes Json
@default("[]")`). The seed now creates a scenario with its changes in
one write, validated by the domain.

**Slice 2 — read API.** List (newest first, optional `status` filter),
detail, and `calculate`. The list repository query had no `orderBy`, so
its order was arbitrary; it is now `createdAt` desc then `id`, and the
contract documents it (the demo mock must respect it). `calculate` is
stateless: stored `changes` + the portfolio's CURRENT positions, nothing
written, so the baseline cannot change (FR-036, `01-product-spec.md`
§15.1; an integration test checks the positions in the DB afterwards).
Response: `scenarioId`, `baseline`, `result`, `difference`,
`unmatchedAssetIds` (assets the scenario changes but the portfolio does
not hold; the calculation ignores them, reporting avoids a silent
no-op). Outputs are total value and unrealized P/L only; allocation,
risk and exposure from FR-038 are not computed because the domain cannot
derive them honestly.

**Slice 3 — write API.** Create (201, always a `DRAFT`), `PATCH`
(`name`, `description`, `status` DRAFT or SAVED, `changes`; at least one
field), archive, delete (204). `changes` replaces the whole list, so
reset (FR-039) is `changes: []` and save (FR-040) is `status: "SAVED"`.
The repository `update` now accepts `changes` so a combined edit is a
single write (an invalid part of a request changes nothing; covered by a
test). `ARCHIVED` is read-only: `PATCH` returns 409 `CONFLICT`, and
there is no un-archive (no FR asks for it); archive is idempotent with
`meta.alreadyArchived`, like portfolios. Unknown assets in `changes` are
a 400 listing all of them (`UNKNOWN_ASSET`), not a 404 like Alerts,
because the missing thing is a body field; only existence is checked,
not that the portfolio holds the asset.

**Slice 4 — compare (FR-042).** `01-product-spec.md` §15.2 asks for
"meaningful differences rather than only separate charts"; `calculate`
totals cannot show which asset explains a difference or how allocation
shifts. So: pure domain function `compareScenarioImpacts` (reusing the
extracted `applyScenarioChanges`, `calculateAllocation` and
`calculatePortfolioMetrics`) and `POST .../scenarios/compare` with 1 to 5
distinct ids (any missing or foreign id makes the whole request a 404,
so no column is silently dropped). Per asset it reports value,
difference, allocation and allocation shift in percentage points,
ordered by size of difference; the service adds each asset's `symbol`
and `name` with one batched lookup. No ranking (derivable by the client).
The `07-api-spec.md` §25 contract is documented there.

**Tests:** 3 integration files (`scenarios.routes`, `scenarios.write.routes`,
`scenarios.compare.routes`), domain tests for validation and comparison,
plus repository tests (changes read/write/reset, defensive reads, list
order). New fixtures `createTestPosition` and `createTestScenario`. One
lint fix: zod v4 `z.number()` already rejects infinity, so `.finite()` is
deprecated and was removed (the domain still validates finiteness).

**Verification:** lint, typecheck and the domain, database and api test
suites passed.

---

## 4. Environment Files Reference

| File | Committed? | Purpose |
|---|---|---|
| `.env.example` | Yes | Template for development (`.env`) |
| `.env` | No (git-ignored) | Real dev config — `trading_analytics_dev`, port 7001 |
| `.env.test.example` | Yes | Template for test config |
| `.env.test.local` | No (git-ignored, matches `.env.*.local` pattern) | Real test config — `trading_analytics_test`, `NODE_ENV=test`, a test-only `JWT_SECRET` |

**To set up a fresh clone:** copy both `.example` files, adjust
Postgres credentials, then:
```powershell
docker compose up -d
pnpm install
pnpm --filter @trading/database db:generate
pnpm --filter @trading/database db:migrate   # dev database
pnpm --filter @trading/database db:seed
# one-time, via psql/TablePlus against the same Postgres instance:
#   CREATE DATABASE trading_analytics_test OWNER trading_user;
pnpm --filter @trading/database db:test:migrate   # test database
```

**Note:** if resuming after this session, re-run `db:seed` against the
dev database at least once — Step C widened the historical price
series from 30 to 90 days and added `MarketPrice` rows that didn't
exist before.

---

## 5. Last Commits (this session, chronological)

```
build(repo): add build scripts to domain, database and workspace root
feat(database): add unit of work to make transaction creation atomic
refactor(api): import domain package by name instead of relative path
feat(api): add paginated assets list and detail endpoints
feat(api): add portfolio allocation and attribution analytics endpoints
feat(api): paginate portfolio transactions list
feat(api): add portfolio overview read model
fix(api): map body parser errors to 400/413 and unify port configuration
test(database): run tests against a separate test database
test(api): extract createApp for testability and wire up vitest/supertest
test(api): add integration test suite for auth, portfolios, transactions and middleware
docs(progress): update progress after phase 3 hardening and analytics endpoints
feat(api): add market price/history endpoints and extend overview with dailyChange and pulse
feat(domain): add getByUserAndAsset to watchlist item repository contract
feat(database): implement getByUserAndAsset in prisma watchlist repository
test(database): cover getByUserAndAsset in watchlist repository tests
feat(api): add watchlist endpoints (list, add, remove)
feat(api): add alerts endpoints (list, get, create, update, delete)
feat(domain): add getById to notification repository contract
feat(database): implement getById in prisma notification repository
test(database): cover getById in notification repository tests
feat(api): add notifications endpoints (list, mark read, mark all read)
fix(database): make user preference update an atomic upsert
test(database): cover first-write upsert in user preference repository tests
feat(api): add user preferences endpoints (get, update)
test(api): add shared token helper and notification fixture for integration tests
test(api): add watchlist integration tests
test(api): add alerts integration tests
test(api): add notifications integration tests
test(api): add user preferences integration tests
docs(progress): update progress after step d

# --- feat/decisions (branched from develop) ---
feat(domain): accept optional createdAt and timestamp on decision inputs
feat(database): persist explicit decision and event timestamps in seed
feat(domain): add pure decision replay projection
docs(data-model): document decision event payload conventions
feat(api): add decisions list, detail and replay endpoints
test(api): cover decisions endpoints with integration tests
docs(api-spec): reconcile decisions list filters and replay response
docs(api-spec): mark decision write endpoints as deferred
docs(progress): update progress after decisions and replay

# --- feat/scenarios (branched from develop) ---
feat(domain): add changes to scenario entity and validate them
feat(database): read and write scenario changes in repository and seed
docs(data-model): document scenario changes as part of the entity
feat(api): add scenarios list, detail and calculate endpoints
test(api): cover scenarios endpoints with integration tests
fix(database): order scenario list newest first
docs(api-spec): reconcile scenarios read endpoints
feat(database): let scenario update carry changes in one write
feat(api): add scenarios create, update, archive and delete endpoints
test(api): cover scenarios write endpoints with integration tests
docs(api-spec): document scenarios write contract
refactor(domain): extract applyScenarioChanges from scenario impact
feat(domain): add pure scenario comparison calculation
feat(api): add scenarios compare endpoint
test(api): cover scenarios compare endpoint
docs(api-spec): document scenario compare contract
docs(progress): update progress after scenarios
```

(Exact wording/order of commits, and whether the last one was split
into two, may differ slightly from what was actually typed — confirm
against `git log` if precision matters.)

A PR was opened and merged earlier in this session for the base Phase
2-3 work (portfolios/positions/transactions CRUD, database
infrastructure) from `feat/database-infrastructure` into `main`,
**before** the hardening and Assets/Analytics/Overview/Market Data work
described in this document — that work lived on `feat/api-foundation`,
which was later merged via PR into `develop` (not `main`).

---

## 6. Immediate Next Step: finish the backend (see `BACKEND-ROADMAP.md`)

Agreed order of work, set earlier in this effort: (1) merge
`feat/api-foundation` — done, into `develop`; (2) Decisions + Replay —
done on the read side; (3) Scenarios — done; (4) Auth/RBAC; (5) Frontend
and Demo Mode.

**Decision (user):** finish the whole backend before starting the
frontend and the public demo. The ordered plan, with scope, open
decisions and "done when" criteria for each block, is in
**`docs/BACKEND-ROADMAP.md`**. Order: B1 performance and risk analytics,
B2 auth and RBAC, B3 observability, B4 background jobs and idempotency,
B5 realtime, B6 OpenAPI and contract, B7 deployment readiness. The
`feat/scenarios` PR is merged into `develop`.

**Next:** the user picks the first block (B1 is the recommendation: it
is the only P0 product requirement still missing, FR-025). Each block
starts by taking its open decisions to the user; B2 first needs the
role model reconciled (the SDD contradicts itself, roadmap section 5).
The frontend-side questions (where `apps/web` lives, how it consumes
`@trading/domain`, slice order) are listed in the roadmap's handoff
section and are settled when that phase starts.

Remaining backend work (summary; the roadmap is authoritative):
- **RBAC + user registration** (Phase 4 proper).
- **`performance` by period** (FR-025/026) — needs a transaction-aware
  portfolio value time series, flagged in §2.4/§3.5 as intentionally
  deferred rather than fabricated.

---

## 7. Deferred / Open Items (not urgent, tracked so they aren't forgotten)

- **RBAC + user registration** (Phase 4 proper) — no route currently
  needs role restriction, so this remains deferred by choice, not
  oversight.
- **CI (GitHub Actions)** — explicitly decided against for now. This
  project's deployment model is: demo hosted on the portfolio site
  (mocked infra, not yet built), backend runs **locally only** for
  interview demonstrations. Without continuous deployment, CI adds
  process overhead without protecting anything `pnpm test` run
  locally doesn't already catch. Revisit only if a CI badge becomes
  desirable for portfolio narrative purposes — isolated, low-cost
  addition if/when wanted.
- **`apps/api` production build path is untested/likely broken:**
  `apps/api/package.json` has `"start": "node dist/index.js"`, but
  `@trading/domain` and `@trading/database` currently point `main`/
  `types` at `./src/index.ts` (not compiled output), so `node
  dist/index.js` would not resolve those packages correctly in a real
  production run. Not urgent — deployment is Phase 14, and local `dev`
  (via `tsx watch`) is the only mode actually used today. Flagged here
  so it isn't a surprise later.
- **Concurrency on position recalculation:** two simultaneous
  transactions against the same portfolio+asset could race between the
  read-then-write of the position inside the Unit of Work. The Unit of
  Work solves atomicity (all-or-nothing), not this isolation problem.
  Not addressed yet — no concrete evidence it's caused a real issue,
  and fixing it (e.g. `SELECT ... FOR UPDATE` or a higher isolation
  level) is straightforward when it becomes relevant.
- **Search filters (Assets, Transactions) don't escape SQL wildcard
  characters** (`%`, `_`) in the `search`/`contains` filter — a search
  term containing them would be interpreted as a Prisma/Postgres
  pattern rather than literal text. Low severity (no injection risk,
  Prisma parameterizes the query; worst case is a slightly wrong
  match), but not yet verified or fixed.
- **`interval` on `/assets/:assetId/history` only supports `"1d"`.**
  User has explicitly confirmed this is fine for now and that
  weekly/monthly aggregation (a real rollup of existing daily candles,
  not fabricated data) is a planned future addition — not urgent, not
  forgotten.
- **No dedicated integration test for the Overview endpoint's new
  `dailyChange`/`pulse` fields** (Step C) — only manually verified via
  Postman. The underlying domain calculations are unit-tested; the
  wiring itself (which market prices/historical candles get fetched
  and passed through) is not covered by an automated HTTP-level test.
  Consider adding one if this area sees further changes.
- ~~`07-api-spec.md` not yet updated for Step D divergences~~ — done:
  §26-29 now carry "Implementation note (Step D)" callouts documenting
  the real `unreadOnly` filter, no `type`/pagination on notifications,
  `GET /preferences` returning `data: null`, and the alert/watchlist
  ownership and error-code behavior.
- **Notifications have no producer yet:** the API can list and mark
  them, but nothing creates them at runtime (only the seed does). The
  producers (transaction completed, alert triggered, job events) belong
  with Realtime/Background Operations (Phases 9-10).
- **Alerts are configuration only:** nothing evaluates alert
  conditions against market prices yet (FR-053 evaluation is part of
  the realtime/market-simulation work, not CRUD).
- **`tokenFor` migration (optional):** `portfolios`/`transactions`
  tests still sign JWTs inline; could adopt `test-utils/auth.ts`.
- **Decision write endpoints** (create/update/close) and the event
  journal endpoint: deferred, see §3.7. Prerequisite when revisited:
  extend `UnitOfWork` to cover decisions and events.
- **Replay `riskLevel` limitation:** `projectDecisionReplay` starts from
  `decision.riskLevel` because the model stores no original risk level;
  if a `RISK_CHANGED` is already reflected in the stored value, early
  frames show the later one. Documented in the code; only fixable with
  a new field.
- **Event ordering ties:** events are ordered by `timestamp` only; two
  events with the exact same millisecond could swap. Not an issue with
  the seed's real dates; add a tiebreaker if events ever get created
  in bursts.
- **`dateFrom`/`dateTo` on decisions** are assumed to filter on
  `createdAt` (covered by one integration test); confirm if the
  semantics ever matter beyond that.
- **Decision statuses in the seed:** `NEUTRAL` direction P/L is computed
  as LONG in replay; revisit if NEUTRAL decisions with positions appear.
- **Duplicate scenario (FR-041, P2)** is not implemented. It would be a
  `POST .../scenarios/:scenarioId/duplicate` creating a `DRAFT` copy of
  the name (suffixed) and `changes`.
- **`ScenarioRepository.updateChanges` has no production caller:** the
  service uses `update`, which now also carries `changes` (single write).
  It remains in the contract and tests as a changes-only shortcut;
  candidate to remove if it is still unused when the demo mock is built.
- **FR-038 outputs not computed:** `calculate` returns total value and
  unrealized P/L only. `compare` adds per-asset allocation, but risk and
  exposure are not derived anywhere (the domain has no honest way yet).
- **`compare` is not in the original spec** (`07-api-spec.md` §25 lists
  only `calculate`); it is documented there as an addition. Percentages
  in it (`totalValuePercent`, allocation) use JS numbers, for display;
  money values stay `Money`/decimal.
- **`Scenario.baseSnapshotId` is never set:** nothing creates baseline
  snapshots; the baseline is always the live positions. Keep the column
  unless a snapshot feature is ever designed.
- **Defensive read of scenario `changes` hides corruption:** malformed
  stored entries are skipped silently (by design, a read must not 500).
  If data integrity ever needs surfacing, log skipped entries.
- **Dev database re-seed:** the scenario seed step changed (creates the
  scenario with its `changes` in one write); run `db:seed` once.

---

## 8. How to Resume Work in a New Chat

1. Read this file first.
2. Confirm current branch (`develop`, or the active feature branch)
   and that
   `git status` is clean.
3. Run the full verification loop to confirm nothing regressed since
   last session:
   ```powershell
   pnpm install
   pnpm typecheck
   pnpm lint
   pnpm --filter @trading/domain test
   pnpm --filter @trading/database test
   pnpm --filter @trading/api test
   ```
4. Re-seed the dev database if it wasn't done at the end of the last
   session (see §4 note): `pnpm --filter @trading/database db:seed`.
5. Ask the user which block comes next (§6), then proceed.
