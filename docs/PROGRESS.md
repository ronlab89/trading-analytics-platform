# Trading Analytics Platform — Progress

**Last updated:** end of Phase 3 hardening (Steps A + B) + start of decision point before Step C (Market Data)
**Branch:** `feat/api-foundation` (created from `feat/database-infrastructure`, which was closed via PR covering Phases 2-3 base work)

---

## 1. Current Phase & Step

Per `15-implementation-plan.md`:

- **Phase 0 — Repository Foundation:** ✅ Complete
- **Phase 1 — Product/Domain Foundation:** ✅ Complete
- **Phase 2 — Database and Infrastructure:** ✅ Complete
- **Phase 3 — Backend/API Foundation:** ✅ Complete, including a hardening
  extension beyond the original plan scope (see §3 below)
- **Phase 4 — Authentication/RBAC:** ⏸ Partially done. JWT login +
  `authenticate` middleware exist and are tested. **RBAC (`requireRole`
  middleware) and a registration endpoint are deliberately deferred** —
  no route currently needs role-based restriction, and users are seeded
  directly (no self-registration flow exists yet).

**We are between Phase 3 and Phase 4/5**, extending the API surface with
capabilities the original phase list under-specified (Assets, Analytics,
Overview) and hardening what already existed, before deciding the next
block of work.

**Next planned step ("Step C"):** Market data — seed `MarketPrice` and
`HistoricalPrice`, then add price/batch/history endpoints
(`07-api-spec.md` §17-19). This unlocks `dailyChange`, `performance`,
drawdown/volatility inputs, and `pulse` in the portfolio overview, all
of which are currently *deliberately omitted* rather than fabricated
(per `15-implementation-plan.md` §3: "Do not invent performance,
business, or user metrics").

**Explicitly NOT started yet** (schema exists in Prisma, no API):
Decisions (with replay), Scenarios, Watchlist, Alerts, Notifications,
User Preferences.

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
  User/Credential/Portfolio/Asset/Position/Transaction currently have
  repository implementations and API routes wired up).
- `Money` value object (decimal.js-backed), with `divide()` added this
  session.
- Calculations: `calculatePositionAfterTransaction` (weighted-average
  cost, `InsufficientPositionQuantityError` on oversell),
  `calculatePortfolioMetrics`, `calculatePositionMetrics`,
  `calculateAllocation`, `calculateAttribution`, `calculateDrawdown`,
  `calculateVolatility`, `calculatePortfolioPulse`,
  `calculateScenarioImpact`. All pure, all unit-tested.
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
  no repository/API yet).
- Prisma repository implementations exist for: User, Credential,
  Portfolio, Asset, Position, Transaction, Decision, DecisionEvent,
  Scenario, WatchlistItem, Alert, Notification, UserPreference,
  MarketEvent, MarketPrice, HistoricalPrice (all exported from
  `packages/database/src/index.ts` — repository classes exist ahead of
  their corresponding API routes for several entities; this is schema
  scaffolding, not unused code to clean up).
- `PrismaUnitOfWork` implements `UnitOfWork` using Prisma's interactive
  `$transaction`; wraps `PrismaTransactionRepository` and
  `PrismaPositionRepository` bound to the transactional client.
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
| Analytics | `GET /api/v1/portfolios/:id/analytics/allocation?groupBy=asset\|assetType\|currency`, `GET .../analytics/attribution` | `sector` grouping and attribution `from/to/groupBy` from the spec are deferred — no data exists yet to support them meaningfully. |
| Overview | `GET /api/v1/portfolios/:id/overview` | Purpose-built read model: portfolio + summary + positions (with per-position `allocationPercent`) + allocation + attribction + last 5 transactions. **Deliberately omits** `pulse`, `performance`, `dailyChange` — no historical price data exists yet (see Step C below). |
| Health | `GET /health`, `GET /health/ready` | Registered before rate limiting. |

**Cross-cutting decisions worth remembering:**
- Cross-user resource access is always 404, never 403 (anti-enumeration,
  `09-security-spec.md` §14-15, §51). Applied consistently across
  portfolios, positions, transactions.
- `Page<T>`/`PageRequest` pattern (from `packages/domain`) is now the
  standard for every list endpoint that needs pagination — established
  first for Assets, then reused for Transactions. Response shape:
  `{ data: T[], meta: { page, pageSize, total, totalPages } }`.
- No fabricated metrics anywhere. Where a calculation needs data that
  doesn't exist yet (historical prices), the corresponding field is
  simply absent from the response rather than estimated or hardcoded.

---

## 3. Hardening Done This Session (Steps A + B, beyond original phase scope)

After Phase 3's core endpoints were built, a self-review pass surfaced
technical debt and gaps. Two class of fixes were done, in order:

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

**Result:** 22 tests across 6 files (`app.test.ts` was folded into the
same run), all passing at last verification.

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
```

(Exact wording/order of the last two may differ slightly from what you
actually typed — confirm against `git log` if precision matters.)

A PR was opened and merged earlier in this session for the base Phase
2-3 work (portfolios/positions/transactions CRUD, database
infrastructure) from `feat/database-infrastructure` into `main`,
**before** the hardening and Assets/Analytics/Overview work described
in this document — that work all lives on `feat/api-foundation`, not
yet merged.

---

## 6. Immediate Next Step: Step C — Market Data

**Not started yet.** Plan (to be confirmed in detail when the step
actually begins, this is a placeholder so the next session isn't
starting from zero context):

1. Seed `MarketPrice` (current price snapshot per asset) and
   `HistoricalPrice` (OHLCV-style historical series) — realistic,
   internally consistent with the existing Position/Transaction seed
   data (`05-data-model.md` §33-37: seed data must support all UI
   states and be relationally consistent, not just present).
2. Add endpoints per `07-api-spec.md` §17-19:
   - `GET /api/v1/assets/:assetId/price`
   - `GET /api/v1/market/prices?assetIds=...` (batch)
   - `GET /api/v1/assets/:assetId/history?from=&to=&interval=`
3. Once historical data exists, extend (not replace) the Overview
   response and Analytics with `dailyChange`, `performance`, drawdown,
   volatility, and `pulse` — these were explicitly left out until now
   specifically because there was no real data to derive them from.

**Decisions still open for Step C** (need user input before/at start):
- Exact shape/granularity of seeded historical data (how many days,
  what interval).
- Whether historical price generation reuses any logic from the
  not-yet-built Demo Mode market simulator (`12-demo-mode-spec.md`), or
  is a simpler one-off seed script for now, with the real simulator
  built later in Phase 11.

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
4. Proceed with Step C (Market Data) as described in §6, starting with
   the open decisions listed there.
