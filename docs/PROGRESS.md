# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** End of Phase 2 (Steps 6 and 7 complete) — Phase 2 fully closed. Cutover to
new chat to start Phase 3 (Backend/API Foundation).
**Current branch context:** `feat/database-infrastructure` (created from `develop` after
Phase 1 merge — verify with `git status`/`git log` at the start of next session before
trusting this claim, per the lesson learned in Phase 1 and reinforced repeatedly in Phase 2).

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.
>
> **Filesystem MCP access confirmed working** for this project throughout
> this entire session (root: `Internal Projects/trading-analytics-platform`).
> Every domain contract, repository, and existing file was read directly via
> this MCP immediately before writing or editing anything that depended on
> it — this is now a hard rule for this project, not just a habit (see §5).

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 1 — Product and Domain Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 2 — Database and Infrastructure:** ✅ COMPLETE (this session closed it out)

All sub-steps closed:

- [x] Step 1 — PostgreSQL via Docker Compose (Postgres 18, pinned explicitly)
- [x] Step 2 — `packages/database` package scaffolded; Prisma installed; initial schema slice
- [x] Step 3 — All 15 domain tables confirmed in Postgres
- [x] Step 4 — Repository **contracts** (interfaces only) for all 15 entities
- [x] Step 5 — Real (Prisma-backed) implementations of all 15 repository contracts
- [x] **Step 6 — Seed workflow — COMPLETE THIS SESSION** (sub-steps 6.1 through 6.5, see §3)
- [x] **Step 7 — Local reset workflow — COMPLETE THIS SESSION** (see §3.6)

**Phase 2 has no remaining scope.** The database package is fully seeded, resettable, typed,
linted, and documented.

---

## 2. Next Phase / Step

**Immediate next step:** **Phase 3 — Backend/API Foundation** (`15-implementation-plan.md` §8).

Per the plan, Phase 3's objective is to build the backend application structure:

```text
API
 ↓
Application
 ↓
Domain
 ↓
Infrastructure
```

Recommended first sub-steps to propose at the start of the next session (not decided yet,
to be broken into small approvable slices as usual):

1. Express app scaffolding inside `apps/api` (does not exist yet — confirm with
   `mcp__filesystem__list_directory` before assuming; per the tech stack, `apps/api` is
   the intended location but Phase 2 never touched it).
2. Base middleware: request ID, JSON body parsing, error handling skeleton.
3. Health endpoint (`GET /health`) wired to a real Postgres check via `@trading/database`'s
   `prisma` client — first real consumer of the database package from outside its own
   package boundary, a good early validation that the repository/barrel exports work as
   intended for a real consumer.
4. Only after the above is stable: start wiring the first real application service
   (likely Portfolio, per `15-implementation-plan.md` §25 API Implementation Order:
   Health → Auth → Users/session → Portfolios → ...).

**Key question to resolve before Phase 3 starts** (not decided yet): does `apps/api` exist
at all yet, or does Phase 3 Step 1 need to scaffold it from scratch (package.json, tsconfig,
Express install)? This determines whether Phase 3's first sub-step is "0.5" (bootstrap the
app) or can jump straight into middleware. Verify with the filesystem MCP, don't assume.

---

## 3. What's Been Implemented This Session (Phase 2, Steps 6 and 7)

### 3.1 Step 6.1 — Seed scaffolding

```text
packages/database/src/seed/
├── context.ts          # SeedContext, SeedPortfolioRef, SeedAssetRef
├── resolve.ts           # resolvePortfolioId/resolveAssetId — shared by every data-seeding step
├── wipe.ts               # wipeDatabase() — deletes all 15 tables in strict reverse-FK order
├── index.ts               # seedDatabase() orchestrator — wipes, then chains every step below
├── data/                   # pure data blueprints, one file per entity group
│   ├── user.ts
│   ├── portfolios.ts
│   ├── assets.ts
│   ├── positions-and-transactions.ts
│   ├── decisions.ts
│   ├── scenarios.ts
│   ├── alerts.ts
│   ├── notifications.ts
│   └── historical-prices.ts
└── steps/                   # persistence logic, one file per entity group
    ├── seed-users-and-portfolios.ts
    ├── seed-assets.ts
    ├── seed-positions-and-transactions.ts
    ├── seed-decisions.ts
    ├── seed-scenarios.ts
    ├── seed-alerts.ts
    ├── seed-notifications.ts
    └── seed-historical-prices.ts

packages/database/prisma/seed.ts   # entry point Prisma invokes (calls seedDatabase(), disconnects)
```

`wipeDatabase()` deletion order (derived from reading `schema.prisma` directly, not assumed):

```text
DecisionEvent -> MarketEvent -> HistoricalPrice -> MarketPrice -> WatchlistItem ->
Notification -> UserPreference -> Alert -> Scenario -> Transaction -> Position ->
Decision -> Asset -> Portfolio -> User
```

### 3.2 Step 6.2 — User, Portfolio, Asset

- 1 demo user (`demo@trading-analytics.dev`)
- 3 portfolios: "Main Portfolio", "Crypto Experimental", **"Empty Portfolio"** (intentionally
  empty — exercises empty-state UI per FR-058)
- 7 assets: AAPL, MSFT, TSLA (STOCK), VOO, QQQ (ETF), BTC, ETH (CRYPTO) — FOREX intentionally
  omitted, no feature currently needs it

### 3.3 Step 6.3 — Position, Transaction

5 positions across 6 transactions (1 BUY + 1 partial SELL for BTC, single BUY for the rest),
built with realistic gain/loss/flat variety, using illustrative prices reused directly from
the SDDs' own examples (not invented):

| Portfolio | Asset | Result |
|---|---|---|
| Main Portfolio | AAPL | Winner (+22.8%), entry $150 -> current $184.22 (07-api-spec.md §17) |
| Main Portfolio | MSFT | Loser (-8.3%), entry $420 -> current $385 |
| Main Portfolio | VOO | ~Flat (+0.2%), entry $480 -> current $481 |
| Crypto Experimental | BTC | Big winner (+87%), avg entry $60,000 -> current $112,450.20 (01-product-spec.md §16) |
| Crypto Experimental | ETH | Mild loser (-3.1%), entry $3,200 -> current $3,100 |
| Empty Portfolio | — | No positions (by design) |

All transactions created via `create()` then explicitly moved to `COMPLETED` via
`updateStatus()` — confirmed `CreateTransactionInput` does not accept `status` at all (schema
default is `DRAFT`). All seed transactions represent already-settled history; transient
states (`PROCESSING`/`FAILED`) are reserved for Demo Mode failure injection (Phase 11), not
hardcoded here.

Average entry price for BTC computed by hand using the average-cost method (a partial sell
reduces quantity but does not change the average entry price) — not derived by a calculation
engine, because `calculatePositionMetrics` in the domain package derives metrics **from** a
Position, it does not derive a Position **from** transaction history; that derivation logic
doesn't exist yet (belongs to a future FR-017 application-layer workflow).

### 3.4 Step 6.4 — Decision, DecisionEvent, Scenario, Alert, Notification

- **2 Decisions**, narratively paired with the AAPL (successful) and MSFT (failed) positions
  above, same entry prices/dates for coherence. 5 `DecisionEvent` each (10 total): CREATED ->
  THESIS_RECORDED -> POSITION_OPENED -> PRICE_UPDATE -> TARGET_REACHED/POSITION_CLOSED.
  Decisions are closed via `decisionRepository.close(id, outcome, closedAt)` — outcome is not
  part of `CreateDecisionInput`, confirmed from the contract.
- **1 Scenario** ("Increase tech exposure", `SAVED`), changes: AAPL +15%, MSFT -10%. Created
  via `create()`, changes persisted separately via `updateChanges()`.
- **3 Alerts**: BTC PRICE ABOVE 120,000 (active, not yet crossed), AAPL PRICE ABOVE 180
  (active, already crossed by the seeded current price — represents "triggered" without a
  dedicated triggered field, since Alert has none), Main Portfolio VOLATILITY ABOVE 20
  (`enabled: false`, manually disabled).
- **5 Notifications**: 2x SUCCESS (transaction completed, both marked read via
  `markAsRead()`), 1x WARNING (alert triggered, unread), 1x INFO (portfolio change, unread),
  1x ERROR (simulated past failure, unread, clearly demo/dev data — not a reliability claim).

**Important correction confirmed mid-session:** neither `Decision.createdAt` nor
`DecisionEvent.timestamp` are accepted by their respective `CreateXInput` types — both are
always repository-assigned (`@default(now())` / always-now per Step 5's own documented
decision). The blueprint fields with those names are narrative-only ordering aids for
readability of the seed data files; they are never actually passed to a repository call.
This was caught and documented in code comments before it could mislead a future reader.

### 3.5 Step 6.5 — HistoricalPrice

210 OHLCV candles (30 daily candles x 7 assets), generated by a small **deterministic**
generator function (`generateDailyCandles` in `data/historical-prices.ts`) — no
`Math.random()`, no PRNG; uses fixed `Math.sin()` terms over the day index, so re-running
always produces the identical series. Explicitly **not** related to Demo Mode's
`simulationSeed` concept (Phase 11, browser-only market simulation) — different code,
different purpose, deliberately kept unconflated per the Step 6.1 vocabulary decision.

OHLC ordering invariants (`high >= max(open, close)`, `low <= min(open, close)`) are
guaranteed **by construction** (high/low computed as `max`/`min` plus/minus a margin), not
by validating and retrying — so `validateNewHistoricalPrice` never has a chance to reject a
generated candle.

The final candle of each series is pinned to exactly the same "current price" already used
in Step 6.3 (e.g. AAPL's chart ends at $184.22, BTC's at $112,450.20), so the seeded chart is
visually consistent with the seeded position.

TSLA and QQQ (no seeded Position) get freestanding, reasonable end prices ($265 and $505)
since historical price data is asset-scoped, not portfolio/position-scoped.

### 3.6 Step 7 — Local reset workflow

Two documented reset levels, per `14-deployment-spec.md` §21 (no new seed logic needed —
Prisma's own `migrate reset` already auto-invokes the seed script because
`package.json`'s `"prisma": {"seed": "tsx prisma/seed.ts"}` was already configured in 6.1):

- **Light reset** (`pnpm --filter @trading/database db:seed`) — data only, schema untouched.
  This is what already existed since 6.1; Step 7 didn't change its behavior.
- **Hard reset** (`pnpm --filter @trading/database db:reset`, new script this session) —
  `prisma migrate reset`: drops the database, reapplies every migration from scratch, then
  auto-reseeds. Keeps the interactive confirmation prompt by default (no `--force` flag) —
  destructive-action-requires-confirmation applied to dev tooling, same principle as
  `11-ui-ux-spec.md` §20 applies to product UI.

`README.md` updated with a new "Local Database" section documenting both levels, plus a
staleness fix (the `## Status` section had said "Phase 0, no application code yet" since
before this session — corrected to reflect Phase 2 completion; `## Structure` now lists
`packages/domain` and `packages/database`, which it never had before).

---

## 4. Key Decisions Made This Session

| Decision | Reason |
|---|---|
| **DB seed goes through the repository layer** (`Prisma*Repository`), never raw Prisma calls, except for `wipeDatabase()` | Wipe is a pure infrastructure operation (bulk delete), not a domain operation — it doesn't need domain validation or mapping, so using `prisma` directly there is correct and doesn't violate the "seed via repositories" principle, which applies to *creating* data. |
| **Two "seed" vocabularies kept strictly separate**: `seedDatabase()` (this Step 6, Prisma/dev data) vs. `simulationSeed` (Demo Mode, Phase 11, browser-only market simulation) | Explicitly flagged as a real risk of confusion in the previous session's handoff; resolved by naming convention alone — no shared code, no shared types, deliberately. |
| **Idempotent via wipe-and-reseed** (`deleteMany` in strict reverse-FK order), not upsert-by-natural-key | Most seeded entities have no clean natural key (they're identified by generated `id`s). Wipe-and-reseed matches the actual use case ("give me a known-clean state") and avoids silent drift from stale rows that an upsert might leave behind. |
| **`SeedContext` stores `{id, name}` / `{id, symbol}` pairs, not bare id arrays** (revised mid-Step-6, originally bare arrays in 6.1/6.2) | Step 6.3 needed to resolve "Main Portfolio" -> its real database id and "BTC" -> its real id without re-querying. Small, justified extension once the actual need appeared — not speculative upfront design. |
| **`resolvePortfolioId`/`resolveAssetId` extracted to a shared `src/seed/resolve.ts`** once a second step needed them (Step 6.4), rather than duplicating the same two functions across 5 step files | Same DRY judgment call already established in Step 5 for mappers — duplication becomes a maintenance and drift risk starting at the second real usage. |
| **Position `averageEntryPrice`/`quantity` are hand-computed and hardcoded in the blueprint** (average-cost method), not derived at seed time by a generic calculator | No such derivation (transaction history -> position) exists yet in the domain layer; writing one just for a one-time seed script would duplicate/anticipate logic that belongs to a future application-layer transaction workflow (FR-017), which is explicitly against NFR-070 (avoid artificial complexity). |
| **All seed transactions are created then immediately moved to `COMPLETED`** via `updateStatus()`, never left in `DRAFT`/`PROCESSING`/`FAILED` | Confirmed `CreateTransactionInput` doesn't accept `status` at all. Seed data represents already-settled history; transient/failure states are reserved for Demo Mode failure injection (Phase 11), not for hardcoded seed data — avoids conflating "historical fact" with "simulated in-flight operation." |
| **Illustrative prices reused directly from the SDDs' own examples** (AAPL $184.22 from `07-api-spec.md` §17, BTC $112,450.20 from `01-product-spec.md` §16) rather than inventing new figures | Consistent with `12-demo-mode-spec.md` §85 ("no invented measurements/figures") in spirit — these are demo/dev seed values, not performance claims, but reusing the spec's own illustrative numbers keeps the whole document set internally consistent rather than introducing yet another set of arbitrary numbers. |
| **HistoricalPrice OHLCV generated by a small deterministic function** (`Math.sin()` over day index, no PRNG/`Math.random()`), not hand-authored, not a "real" simulation engine | ~210 rows hand-written would be error-prone (easy to accidentally violate OHLC ordering invariants) and tedious to review; a small pure function guarantees the invariants by construction and is trivially reviewable as a single formula, without building anything resembling the Phase 11 simulation engine prematurely. |
| **Alert "triggered" state modeled via a paired Notification, not a field on Alert** | The domain's `Alert` entity has no `triggeredAt`/boolean field for this — `05-data-model.md` §22 doesn't define one either. Rather than inventing an undocumented field, the "already crossed" alert (AAPL) is paired with a corresponding `ALERT_TRIGGERED`-type Notification, which is how the spec's own event catalog (`07-realtime-spec.md` §15, `ALERT_TRIGGERED`) represents this concept. |
| **`prisma migrate reset` used directly for the hard reset**, no custom reset script written | Prisma already solves this robustly (drop, recreate, migrate, auto-seed via the existing `"prisma": {"seed": ...}` config) — reimplementing it would be pure NFR-070 violation (artificial complexity for a solved problem). |
| **No `--force` flag added to `db:reset`** | Keeps the interactive confirmation prompt — a hard reset is destructive by nature and should require explicit confirmation, same principle the UI/UX spec applies to destructive product actions, extended to dev tooling. |

---

## 5. Corrections / Bugs Caught This Session

Same discipline as Phase 2 Step 5 — every fix below was found by reading real files via the
filesystem MCP or by hitting real tool/compiler output, never assumed:

1. **`packages/database/src/seed/` didn't exist at all** the first time `prisma/seed.ts` was
   written — it imported `seedDatabase` from the public barrel (`../src/index.js`, which only
   exports `prisma` + the 15 `Prisma*Repository` classes) instead of the not-yet-created
   `../src/seed/index.js`. Caught via the user's own `tsc`/lint error output, not by review.
   Fixed by actually creating the missing files via the filesystem MCP.
2. **`packages/database/tsconfig.json`'s `include` only listed `["src"]`**, silently
   excluding `prisma/seed.ts` from the project's type-aware linting — same category of bug as
   Step 5's `packages/database` vs. root `tsconfig.json` `references` omission, just one
   level deeper this time (a file, not a whole package). Fixed by widening `include` to
   `["src", "prisma"]` and `rootDir` to `"."`.
3. **A stale `packages/database/tsconfig.tsbuildinfo`** masked the above fix from taking
   effect immediately, producing a confusing `no-unsafe-call` lint error with no clear
   location — identical root cause to the one already documented in the previous session's
   PROGRESS.md §5 item 7, just recurring in a different package. Deleting the file (no
   `delete` tool available via the filesystem MCP; done via terminal `rm`) resolved it.
4. **`tsx` was never added as a devDependency** of `@trading/database` — `pnpm db:seed`
   failed with `spawn tsx ENOENT` the first time it was run. This was explicitly anticipated
   in the Step 6.1 handoff notes and confirmed exactly as predicted. Fixed with
   `pnpm add -D tsx --filter @trading/database`.
5. **A genuinely pre-existing, unrelated bug** in `packages/domain/src/entities/market-price.test.ts`
   (Phase 1 code, never touched this session until this fix) was surfaced by running
   `pnpm typecheck` from the repository root for the first time in a while: the shared
   `baseInput` object used across ~9 test cases was missing the now-required `timestamp`
   field. This had nothing to do with Step 6/7 — it was masked until a full root-level
   `tsc --build` actually recompiled `packages/domain`. Fixed with a one-line addition
   (`timestamp: new Date("2026-08-29T14:30:00Z")`), committed separately from the Step 6.1
   scaffolding commit per the project's "unrelated changes get separate commits" rule.
6. **`Decision.createdAt` and `DecisionEvent.timestamp` are not settable** via their
   respective `CreateXInput` types (confirmed by reading `decision.ts`/`decision-event.ts`
   directly) — the initial seed data design implicitly assumed they would be persisted as
   written in the blueprint. Caught during contract review *before* writing the persistence
   step (not after a failed run), and documented explicitly in code comments on the
   blueprint fields so a future reader isn't misled into thinking those dates are what
   actually lands in the database.

**Lesson reinforced (again, third time across three sessions now):** reading the actual
domain entity + repository contract file directly, immediately before writing anything that
depends on its shape, caught real mismatches every single time this was done and would have
been missed by assumption alone (items 1, 2, and 6 above specifically). This is no longer
optional practice for this project — treat it as a hard requirement for every future phase,
starting with Phase 3's Express/API layer.

---

## 6. How to Resume From Here (Phase 3 kickoff)

1. Read this file in full.
2. Use the filesystem MCP to independently verify current repo state:
   - Confirm `packages/database/src/seed/` has the full structure described in §3.1-3.5
     (9 `data/*.ts` files, 8 `steps/*.ts` files, `context.ts`, `resolve.ts`, `wipe.ts`,
     `index.ts`).
   - Confirm `packages/database/package.json` has `db:reset` in its `scripts` block.
   - Confirm `README.md` has the "Local Database" section and an up-to-date `## Status`.
   - Confirm whether `apps/api` exists yet at all (§2 above — this determines Phase 3's
     actual first sub-step).
3. Confirm local repo state: `git status`, `git branch --show-current`, `git log --oneline -30`.
4. Confirm Docker Postgres is running before doing anything that touches the database:
   `docker compose ps`.
5. Sanity-check the seed is still in a good, verified state before building anything on top
   of it: `pnpm --filter @trading/database db:reset` (hard reset, confirms migrations +
   seed both still work end-to-end from a clean slate) or at minimum `pnpm db:seed`.
6. Re-read `06-architecture.md` §24-31 (Backend Architecture, Module Structure, API Boundary,
   DTO Boundary) and `07-api-spec.md` §1-9 (principles, versioning, base response model,
   error response, authentication endpoints) together before proposing Phase 3 Step 1 —
   these define the actual target shape for what gets scaffolded first.
7. Propose Phase 3 as small, approvable sub-steps (same pattern as every step in Phase 2),
   starting with whatever §2's open question above resolves to (either "bootstrap apps/api
   from scratch" or "add middleware to an existing apps/api").

---

## 7. Last Relevant Commits (this session, chronological)

```
feat(database): scaffold db seed workflow with idempotent wipe
fix(domain): add missing timestamp to market-price test baseInput
feat(database): seed demo user, portfolios and asset catalog
feat(database): seed positions and transactions with realistic gain/loss/flat variety
refactor(database): extract shared portfolio/asset id resolution helper
feat(database): seed decisions, decision events, scenarios, alerts and notifications
feat(database): seed historical OHLCV prices via deterministic candle generator
chore(database): add hard reset script and document reset workflow
docs(readme): document local database seed and reset workflow
docs(readme): update project status and structure to reflect phase 2
```

Exact order/squashing at merge time is a decision for the next PR review, not fixed here.

---

## 8. Open Items / Pending Decisions

- **8.1 through 8.4 (carried over from Phase 2 Step 5, all resolved this session)** — the
  seed workflow design questions, DB-seed-vs-Demo-Mode-seed naming, idempotency mechanism,
  and reset workflow are all now decided and implemented. No longer open.
- **8.5 — Prisma major version** — still deferred (release candidate, not stable per
  `04-tech-stack.md` §2). Still on `^6.0.0`/`6.19.3`. Revisit only once Prisma 8 reaches a
  real stable release, as its own isolated decision/PR — not touched this session.
- **8.6 (carried over, still open, still non-blocking) — Branch-source enforcement for
  `main`** — deferred since Phase 0.
- **8.7 (carried over, still open, still non-blocking) — GitHub default branch still
  `main`** — deferred since Phase 0.
- **8.8 (carried over, still open, still non-blocking) — `packages/database`'s `typescript`
  devDependency (`^5.7.3`) still behind the root `package.json`'s `^6.0.3`** — noted in
  Phase 2 Step 5, not fixed, no functional impact observed. Still worth a deliberate,
  isolated version-alignment pass at some point, not bundled into feature work.
- **8.9 (new, non-blocking) — `apps/api` existence unconfirmed** — see §2 and §6 item 2.
  Must be checked at the very start of the Phase 3 session, before proposing any sub-step,
  since it changes what "Step 1" of Phase 3 actually is.
- **8.10 (new, non-blocking) — Watchlist, UserPreference, MarketPrice, MarketEvent tables
  remain unseeded** — this was an explicit, discussed decision (not an oversight): no
  currently-planned feature requires seed data for these four tables yet. If a future phase
  reveals a need, seed them as their own explicit, approved sub-step — not silently bundled
  into unrelated work.