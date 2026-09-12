# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** Mid Phase 2 (Database and Infrastructure) — cutover to new chat to continue with repository implementations
**Current branch context:** `feat/database-infrastructure` (created from `develop` after Phase 1 merge, all work below committed to it — verify with `git status`/`git log` at the start of next session before trusting this claim, per the lesson learned in Phase 1)

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.
>
> **Filesystem MCP access confirmed working** for this project (root:
> `Internal Projects/trading-analytics-platform`). From this session onward,
> the assistant reads files directly via this MCP to verify actual repo
> state before treating any prior PROGRESS.md claim as ground truth — this
> caught and corrected real mismatches during this session (see §5).

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 1 — Product and Domain Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 2 — Database and Infrastructure:** 🔄 IN PROGRESS

Sub-steps closed this phase so far:

- [x] Step 1 — PostgreSQL via Docker Compose (Postgres 18, pinned explicitly — see §5 for the v18 mount-path gotcha)
- [x] Step 2 — `packages/database` package scaffolded; Prisma installed; initial schema slice (`User`, `Portfolio`, `Asset`); first migration applied and verified
- [x] Step 3a — `Transaction`, `Position` models added (introduced `Decimal(18,8)` monetary precision pattern); migration applied and verified
- [x] Step 3b — Remaining 10 entities added to schema (`Decision`, `DecisionEvent`, `Scenario`, `WatchlistItem`, `Alert`, `Notification`, `UserPreference`, `MarketPrice`, `MarketEvent`, `HistoricalPrice`); migration applied and verified — **15 domain tables + `_prisma_migrations` = 16 tables confirmed in Postgres**
- [x] Step 4 — Repository **contracts** (interfaces only, no implementation) for all 15 entities, defined in `packages/domain/src/repositories/`, exported from the domain barrel

**Not yet started (remaining Phase 2 scope per `15-implementation-plan.md` §7):**

- [ ] Step 5 — Real (Prisma-backed) implementations of the 15 repository contracts, in `packages/database`
- [ ] Step 6 — Seed workflow (coherent demo/dev dataset per `05-data-model.md` §33-37)
- [ ] Step 7 — Local reset workflow (documented, not just ad-hoc `docker compose down -v`)

---

## 2. Next Phase / Step

**Immediate next step:** Phase 2, Step 5 — implement the first real repository (`PortfolioRepository` via Prisma) in `packages/database`, following the same "one contract at a time, validate the pattern, then batch the rest" approach used successfully for both the schema and the contracts in this phase.

**Recommended order for Step 5** (mirrors the order contracts were built, so context stays fresh): `PortfolioRepository` → `UserRepository` → `AssetRepository` → `TransactionRepository` → `PositionRepository` → (batch) Decision/DecisionEvent/Scenario → (batch) Watchlist/Alert/Notification/UserPreference → (batch) MarketPrice/MarketEvent/HistoricalPrice.

**Key design question to resolve before Step 5 starts:** where does the Prisma ↔ domain mapping logic live (e.g. converting `Decimal` → `Money`, `Json` → typed `ScenarioChange[]`)? Options: (a) inline in each repository implementation, (b) a small dedicated `mappers/` module in `packages/database`. Not decided yet — flag this as the first question for the next session before writing the first repository implementation.

### Context length note

This phase is already proving longer than Phase 1, as anticipated in the previous PROGRESS.md. Step 5 alone (15 repository implementations, each needing a Prisma client call + domain type mapping) is likely to need at least one more mid-phase cutover. Continue proactively suggesting a chat cutover before context gets unwieldy, rather than waiting for Step 5 to fully complete.

---

## 3. What's Been Implemented

### 3.1 `packages/database` (new this phase)

```text
packages/database/
├── package.json            (name: @trading/database; deps: @prisma/client; devDeps: prisma, dotenv-cli)
└── prisma/
    ├── schema.prisma        (15 domain models + 12 enums — see §3.2 for full list)
    └── migrations/
        ├── <ts>_init/                                          (User, Portfolio, Asset)
        ├── <ts>_add_transaction_and_position/
        ├── <ts>_add_remaining_entities/
        ├── <ts>_make_asset_exchange_and_metadata_required/
        ├── <ts>_align_decision_types_to_domain/
        ├── <ts>_make_notification_preferences_required/
        └── <ts>_rename_market_data_source_enum/
```

Scripts (`package.json`, run via `dotenv-cli` pointing at the repo-root `.env` — see §5 for why): `db:generate`, `db:migrate`, `db:studio`.

### 3.2 `schema.prisma` — final state this phase

**Enums (12):** `UserRole`, `PortfolioStatus`, `AssetType`, `AssetStatus`, `TransactionType`, `TransactionStatus`, `DecisionDirection`, `ScenarioStatus`, `NotificationSeverity`, `AlertType`, `MarketDataSource`, `DecisionEventType`.

**Models (15), all mapped to snake_case tables/columns via `@@map`/`@map`:** `User`, `Portfolio`, `Asset`, `Transaction`, `Position`, `Decision`, `DecisionEvent`, `Scenario`, `WatchlistItem`, `Alert`, `Notification`, `UserPreference`, `MarketPrice`, `MarketEvent`, `HistoricalPrice`.

All monetary/quantity fields use `Decimal(18, 8)` (volume on `HistoricalPrice` uses `Decimal(24, 8)` for extra headroom). IDs use `cuid()`, not autoincrement (non-guessable, per `05-data-model.md` §41).

### 3.3 `packages/domain/src/repositories/` (new this phase)

15 repository **contracts** (interfaces, zero Prisma/infrastructure dependency), all exported from `packages/domain/src/index.ts`:

```text
portfolio-repository.ts          user-repository.ts
asset-repository.ts              transaction-repository.ts
position-repository.ts           decision-repository.ts
decision-event-repository.ts     scenario-repository.ts
watchlist-item-repository.ts     alert-repository.ts
notification-repository.ts       user-preference-repository.ts
market-price-repository.ts       market-event-repository.ts
historical-price-repository.ts
```

One new supporting type was introduced here (not in Phase 1's entities): `ScenarioChange` (`{ assetId, percentChange }`), defined in `scenario-repository.ts` itself rather than in `entities/scenario.ts`, since it belongs to the repository's `updateChanges()` signature and mirrors the shape `calculations/scenario-impact.ts` already expects.

### 3.4 Root-level infrastructure

- `docker-compose.yml` — single `postgres:18` service, named volume (`trading-analytics-postgres-data`), healthcheck via `pg_isready`.
- `.env` / `.env.example` — `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_PORT`, `DATABASE_URL`.

---

## 4. Key Decisions Made This Phase (cumulative)

| Decision | Reason |
|---|---|
| **Postgres 18, pinned explicitly (not `latest`)** | Per `04-tech-stack.md` §2 (use latest *stable*, not bleeding-edge pre-release; a `-rc` update notification from Prisma CLI later in this phase was explicitly declined for the same reason). |
| **Postgres 18's volume mount changed to `/var/lib/postgresql` (not `/var/lib/postgresql/data`)** | Postgres 18's official image restructured its data directory layout for future `pg_upgrade --link` compatibility. Caught via a real startup error; documented here so a future session doesn't reintroduce the old mount path. |
| **`dotenv-cli` to load the repo-root `.env` from `packages/database`** | Prisma CLI only auto-loads `.env` from its own working directory. Rejected duplicating `.env` into `packages/database` (two sources of truth for the DB password) and symlinking (fragile on Windows, which is the actual dev environment here). |
| **Single `schema.prisma` file, not multi-file `prisma/schema/`** | Prisma supports both; single-file chosen for now per NFR-070 (avoid artificial complexity) — this project doesn't have separate teams per domain that would justify the split. Flagged as revisable if the file becomes hard to navigate once Phase 3+ adds more relations. |
| **`Decimal(18, 8)` for all monetary/quantity DB columns** | 8 decimal places covers crypto-level precision (1 satoshi); 18 total digits comfortably covers fiat amounts. Applied uniformly rather than varying by field, for consistency. Mirrors the domain's `Money`/decimal.js decision (`04-tech-stack.md` §28.1) — `quantity` is stored as `Decimal` in Postgres even though the domain layer keeps it as a plain `number` (this is a deliberate infra-vs-domain distinction: fractional crypto quantities lose precision in floats regardless of how the domain models "this isn't currency"). |
| **`cuid()` IDs, not autoincrement integers** | Non-sequential, non-guessable — relevant once these IDs are exposed via a public API (`05-data-model.md` §41). |
| **snake_case tables/columns via `@@map`/`@map`, PascalCase/camelCase models/fields in Prisma/TS** | Standard Postgres convention avoids needing quoted identifiers in raw SQL/external tools; keeps the TypeScript-facing API idiomatic. Applied to every model and every enum. |
| **`onDelete: Restrict` from Transaction/Position to Asset; `onDelete: Cascade` from Portfolio to its children** | Deleting a Portfolio should cascade-delete its own data (Transactions, Positions, Decisions, Scenarios, Alerts). Deleting an Asset that has historical Transactions/Positions must be *rejected* by Postgres — historical financial records must not silently disappear. `AssetStatus.INACTIVE` is the correct path for retiring an asset, not deletion. |
| **`Position` persisted as its own table, not purely calculated on read** | `05-data-model.md` §31 calls Position "derived" from Transaction + market price, but doesn't prohibit materializing it for read performance. Documented in schema.prisma as a materialized projection whose sync is an application-layer responsibility (Phase 3+), not a deviation from the SDD. |
| **`Scenario.changes` and `DecisionEvent.payload` as `Json`, not relational tables** | Both are explicitly left open/variable-shaped by the SDD (`05-data-model.md` §12, §15) and by the domain layer's own decisions (Phase 1: `calculateScenarioImpact` takes plain `ScenarioChange[]`, not a `Scenario` entity). A relational table per event type / per scenario-change-type would add complexity with no real query requirement today (NFR-070). |
| **`Asset.exchange` and `Asset.metadata` made required (not nullable) in Prisma** | *Correction*, not an original design choice — the domain entity (`packages/domain/src/entities/asset.ts`, Phase 1) already defines both as non-nullable. Infrastructure was aligned to the domain, since the domain was implemented and tested first. Same principle applied twice more below. |
| **`Decision.riskLevel` made nullable in Prisma** | *Correction* — the domain entity defines `riskLevel: string \| null` (optional on create). Prisma had it as required; fixed to match. |
| **`DecisionEvent.type` changed from `String` to a proper Prisma enum (`DecisionEventType`)** | *Correction* — initially left as a free string on the (incorrect) assumption that the SDD's "initial examples" framing meant an open list. The domain layer (Phase 1, already implemented/tested) had already settled this as a closed 9-value enum. The domain, once implemented, is the actual source of truth — not a fresh re-reading of the SDD's prose. |
| **`UserPreference.notificationPreferences` made required (not nullable), default `"{}"`** | *Correction* — same category as the three above; domain entity defines it as non-nullable `Readonly<Record<string, unknown>>`. |
| **Prisma enum renamed `MarketPriceSource` → `MarketDataSource`** | *Correction*, naming-only (not a type-safety bug, since Prisma generates its own enum independent of the domain's). Aligned purely to reduce confusion once Phase 3 writes the Prisma↔domain mapper — having two different names for the same concept across the boundary is a maintainability smell worth fixing while already mid-cleanup. |
| **Repository contracts live in `packages/domain`, not `packages/database`** | Per `06-architecture.md` §3.3 (Dependency Inversion) and the demo/real infrastructure-substitution principle (`12-demo-mode-spec.md` §4): the domain must be able to fully describe its contracts without depending on Prisma. `packages/database` (real) and the future demo mock package will both depend *on* `packages/domain`, never the reverse. |
| **`PortfolioRepository.listByUserId(userId)` instead of the SDD-literal `getAll()`** | `06-architecture.md` §12's example shows a bare `getAll()`, but every `Portfolio` has a mandatory `userId` — an unscoped `getAll()` would be a dangerous-by-default API (easy to accidentally leak all users' portfolios). This applies `09-security-spec.md` §14 (Resource Ownership) to the contract's shape itself, not just to a future implementation. Explicitly confirmed with the user as an intentional deviation, not a silent one. |
| **No generic `update()`/`delete()` on `TransactionRepository` or `DecisionEventRepository`; `updateStatus()` only for Transaction** | `05-data-model.md` §43 (Historical Integrity): a transaction is a historical fact once recorded — only its processing status may legitimately change over time (§10, Transaction Lifecycle). Decision events are an append-only replay log (§12-13) with no legitimate post-creation mutation at all. |
| **`PositionRepository` uses `upsert()` + a dedicated `updateCurrentPrice()`, not a generic `update()`** | Matches how a Position is actually kept current in practice: transaction-driven changes (upsert) vs. high-frequency market-event-driven price updates (`08-realtime-spec.md` §22) are different write paths worth keeping distinguishable for future optimization/observability. |
| **`ScenarioRepository.updateChanges()` kept separate from `update()`** | `changes` (the hypothetical variable edits) is the frequent, interactive write path during Scenario Lab usage (`01-product-spec.md` §15); `name`/`description`/`status` are edited far less often. Separating them keeps the "hot path" explicit. |
| **`MarketPriceRepository` uses `upsert()` only (no separate create/update)** | `MarketPrice` is keyed by `assetId` (one current-price row per asset) — every write is conceptually "set the current price," never a partial edit. |
| **`ScenarioChange` type defined in `scenario-repository.ts`, not added to `entities/scenario.ts`** | Avoids modifying an already-closed, already-tested Phase 1 entity file. It's a repository-contract-level shape (used by `updateChanges()`), and its structure already matches what `calculations/scenario-impact.ts` expects — no new shape was invented. |

---

## 5. Corrections Made This Session (read before trusting anything as "already correct")

Same spirit as the Phase 1 → Phase 2 handoff: several things were caught only by directly reading files (via filesystem MCP) or by hitting real runtime errors, not by trusting assumptions:

1. **Postgres 18 volume mount path** — the compose file was written first with the pre-18 mount path (`/var/lib/postgresql/data`), which failed at container startup with a real, informative Postgres error. Fixed by moving the mount to `/var/lib/postgresql` and recreating the volume with `docker compose down -v` (safe at that point — no real data existed yet).
2. **`Asset.exchange`/`Asset.metadata` nullability** — schema.prisma initially guessed these as optional; the actual Phase 1 domain entity has them as required. Caught by reading `packages/domain/src/entities/asset.ts` directly before writing `AssetRepository`.
3. **`DecisionEvent.type` typed as free `String`** — initial schema assumption (based on the SDD's "initial examples" phrasing) was wrong; the actual Phase 1 domain entity uses a closed `DecisionEventType` enum. Caught the same way, before writing `DecisionRepository`/`DecisionEventRepository`.
4. **`Decision.riskLevel` required in schema** — actual domain entity has it nullable/optional. Caught in the same review pass as #3.
5. **`UserPreference.notificationPreferences` nullable in schema** — actual domain entity has it required. Caught while reviewing entities before Tanda C of the repository contracts.
6. **Repository count miscommunicated as "16" when it is actually 15** — `05-data-model.md` defines 15 entities with their own repository (Primary + Supporting + Market categories); "Derived Models" (`PortfolioMetrics`, `PortfolioPulse`, etc.) are calculated, not persisted, and correctly have no repository. Caught when the user's actual `repositories/` folder (15 files) didn't match a stated count of 16 — verified by listing the directory directly rather than re-deriving the count from memory.

**Lesson reinforced:** every entity file was read directly via filesystem MCP *before* writing its corresponding repository contract, specifically to catch domain/schema mismatches before they propagated into a 16th (well, 15th) round of the same mistake. This caught real issues 3 times in a row during this phase alone (Asset, Decision-group, UserPreference) — continue this practice without exception in Phase 2 Step 5 and beyond.

---

## 6. How to Resume From Here (Phase 2 Step 5 kickoff)

1. Read this file in full.
2. Use the filesystem MCP to independently verify current repo state — confirm `packages/domain/src/repositories/` has exactly 15 files matching §3.3, confirm `packages/database/prisma/schema.prisma` matches §3.2 (especially the corrections in §4/§5 — `Asset.exchange`/`metadata` required, `Decision.riskLevel` nullable, `DecisionEvent.type` as enum, `UserPreference.notificationPreferences` required, `MarketDataSource` enum name), and confirm the domain barrel (`packages/domain/src/index.ts`) exports all 15 repository interfaces.
3. Confirm local repo state: `git status`, `git branch --show-current`, `git log --oneline -20`.
4. Decide (with the user) where Prisma↔domain mapping logic lives before writing the first repository implementation (see §2, "Key design question").
5. Re-read `06-architecture.md` §12-13 (Repository Pattern, Mock Infrastructure) once more before starting, since Step 5's implementations are what those sections describe as the "real adapter" side of the contract.
6. Propose Phase 2 Step 5 as a small, approvable slice — one repository implementation at a time initially (`PortfolioRepository` first, to validate the Prisma-implementation pattern the same way `Portfolio`/`User`/`Asset` validated the schema pattern), batching later ones once the pattern is confirmed, exactly as this phase's schema and contract work was sequenced.
7. Watch context length proactively and suggest a cutover well before Step 5 (15 implementations) is fully done — it is expected to be the longest single step so far in the project.

---

## 7. Last Relevant Commits (this session, chronological)

```
feat(docker): add postgres 18 service via docker compose
feat(docker): add database connection env vars to .env.example
feat(database): add prisma package with initial schema (user, portfolio, asset)
feat(database): apply initial migration for user, portfolio, asset
chore(database): configure dotenv-cli to load env vars from repo root
feat(database): add transaction and position models with decimal precision
feat(database): apply migration for transaction and position tables
feat(database): add decision, decisionevent and scenario models
feat(database): add watchlist, alert, notification and preference models
feat(database): add market price, market event and historical price models
feat(database): apply migration for remaining domain entities
feat(domain): add repository contracts for user, portfolio and asset
feat(domain): add repository contract for transaction
feat(domain): add repository contract for position
feat(domain): add repository contracts for decision, decisionevent and scenario
feat(domain): add repository contracts for watchlist, alert, notification and preference
feat(domain): add repository contracts for market price, market event and historical price
fix(database): align asset, decision and preference schema fields to domain types
fix(database): rename market data source enum for consistency with domain
```

Exact order/squashing at merge time is a decision for the next PR review, not fixed here.

---

## 8. Open Items / Pending Decisions

- **8.1 — Prisma↔domain mapping location** (blocking for Step 5 kickoff, see §2): inline per-repository vs. a dedicated `mappers/` module in `packages/database`. Not discussed yet with the user.
- **8.2 — Prisma major version** — CLI reported a `6.19.3 → 8.0.0-rc.13` update available mid-phase. Explicitly deferred (release candidate, not stable per `04-tech-stack.md` §2). Revisit once Prisma 8 reaches a real stable release, and treat as its own isolated decision/PR — do not bundle a major Prisma upgrade with Step 5 implementation work.
- **8.3 — Seed workflow design** (Phase 2 Step 6, not started) — needs to reference `05-data-model.md` §33-37 (Demo Data Strategy) for what "coherent" seed data means; not yet scoped.
- **8.4 — Local reset workflow** (Phase 2 Step 7, not started) — currently only ad-hoc `docker compose down -v` has been used/verified; a documented, repeatable command/script per `14-deployment-spec.md` §21 has not been created.
- **8.5 (carried over, still open, still non-blocking) — Branch-source enforcement for `main`** (CI check requiring PRs into `main` come from `develop`) — deferred since Phase 0.
- **8.6 (carried over, still open, still non-blocking) — GitHub default branch still `main`** — decision left open since Phase 0.