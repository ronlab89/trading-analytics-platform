# Trading Analytics Platform — Progress

**Last updated:** end of Step D (Watchlist, Alerts, Notifications, User
Preferences endpoints + integration tests)
**Branch:** `feat/api-foundation` (created from `feat/database-infrastructure`,
which was closed via PR covering Phases 2-3 base work)

---

## 1. Current Phase & Step

Per `15-implementation-plan.md`:

- **Phase 0 — Repository Foundation:** ✅ Complete
- **Phase 1 — Product/Domain Foundation:** ✅ Complete
- **Phase 2 — Database and Infrastructure:** ✅ Complete
- **Phase 3 — Backend/API Foundation:** ✅ Complete, including a hardening
  extension and a Market Data extension beyond the original plan scope
  (see §3 below)
- **Phase 4 — Authentication/RBAC:** ⏸ Partially done. JWT login +
  `authenticate` middleware exist and are tested. **RBAC (`requireRole`
  middleware) and a registration endpoint are deliberately deferred** —
  no route currently needs role-based restriction, and users are seeded
  directly (no self-registration flow exists yet).

**We are between Phase 3 and Phase 4/5**, having extended the API
surface with capabilities the original phase list under-specified
(Assets, Analytics, Overview, Market Data) and hardened what already
existed, before deciding the next block of work.

**Step D (small CRUD resources) is complete:** Watchlist, Alerts,
Notifications, User Preferences, each with endpoints and HTTP-level
integration tests (see §3.6).

**Explicitly NOT started yet** (schema + repositories exist in
`packages/database`, no API): Decisions (with replay) and Scenarios.

---

## 2. What's Implemented (Architecture & Endpoints)

### 2.1 Monorepo structure

```text
apps/
  api/                  Express + TypeScript backend
packages/
  domain/               Pure domain layer (entities, calculations, repository contracts)
  database/             Prisma schema, migrations, seed, repository implementations
docs/                   SDD documents (00-15) + this file
```

### 2.2 Domain layer (`packages/domain`)

- Entities with validation functions: User, Credential, Portfolio, Asset,
  Position, Transaction, Decision, DecisionEvent, Scenario,
  WatchlistItem, Alert, Notification, UserPreference, MarketEvent,
  MarketPrice, HistoricalPrice (all have entity files + tests; only
  User/Credential/Portfolio/Asset/Position/Transaction/MarketPrice/
  HistoricalPrice/WatchlistItem/Alert/Notification/UserPreference
  currently have API routes wired up — Decision/DecisionEvent/Scenario
  have repository implementations but no API yet, see §1).
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
  - `calculateScenarioImpact`
- Repository contracts (interfaces only): one per entity, plus:
  - `pagination.ts` — shared `Page<T>` / `PageRequest` primitives, used
    by Asset and Transaction listings (and anything paginated going
    forward).
  - `unit-of-work.ts` — `UnitOfWork` interface for atomic multi-repository
    operations (see §3.2).

### 2.3 Database layer (`packages/database`)

- PostgreSQL via Docker Compose (`docker-compose.yml`), Prisma schema
  with the full `05-data-model.md` entity set already modeled
  (migrations applied for all of it, even though several entities have
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
supertest without binding a port.

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
```

(Exact wording/order of commits, and whether the last one was split
into two, may differ slightly from what was actually typed — confirm
against `git log` if precision matters.)

A PR was opened and merged earlier in this session for the base Phase
2-3 work (portfolios/positions/transactions CRUD, database
infrastructure) from `feat/database-infrastructure` into `main`,
**before** the hardening and Assets/Analytics/Overview/Market Data work
described in this document — that work all lives on `feat/api-foundation`,
not yet merged.

---

## 6. Immediate Next Step: to be chosen (Step D is closed)

No next block has been confirmed by the user yet — **ask at the start of
the next session.** Candidates, all listed under "remaining before
Phase 4/5" below. Before Decisions/Scenarios, the user may also want
to merge `feat/api-foundation` into `main` (a large amount of work now
lives on that branch, see §5).

Remaining before Phase 4/5:
- **Decisions** (with replay) and **Scenarios** — larger, more novel
  pieces (Decision Replay's chronological event projection, Scenario's
  isolated-baseline calculation) that deserve their own planning
  conversation rather than being bundled into "small CRUD."
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

---

## 8. How to Resume Work in a New Chat

1. Read this file first.
2. Confirm current branch (`feat/api-foundation` expected) and that
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
